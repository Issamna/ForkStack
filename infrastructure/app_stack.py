from aws_cdk import (
    Duration,
    Stack,
    aws_lambda as lambda_,
    aws_lambda_python_alpha as lambda_python,
    aws_apigateway as apigateway,
    aws_dynamodb as dynamodb,
    aws_s3 as s3,
    RemovalPolicy,
)
from constructs import Construct
from pathlib import Path


class AppStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        # User identity lives in Clerk now -- no UserTable. App data is keyed by
        # the Clerk user id (the token `sub`).

        # All tables are PAY_PER_REQUEST. CDK's default is PROVISIONED at 5 RCU +
        # 5 WCU per table, which bills 24/7 whether or not anything reads or
        # writes -- with five tables that is 25+25 units of idle capacity, right
        # at the always-free ceiling, and any sixth table tips the whole account
        # into charges. On-demand costs nothing when idle. Don't switch back.
        recipe_table = dynamodb.Table(
            self,
            "RecipeTable",
            partition_key=dynamodb.Attribute(
                name="recipe_id", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
        )
        recipe_tag_table = dynamodb.Table(
            self,
            "RecipeTagTable",
            partition_key=dynamodb.Attribute(
                name="id", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
        )
        ingredient_table = dynamodb.Table(
            self,
            "IngredientTable",
            partition_key=dynamodb.Attribute(
                name="ingredient_id", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.RETAIN,
        )
        meal_plan_table = dynamodb.Table(
            self,
            "MealPlanTable",
            partition_key=dynamodb.Attribute(
                name="user_id", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.RETAIN,
        )
        shopping_list_table = dynamodb.Table(
            self,
            "ShoppingListTable",
            partition_key=dynamodb.Attribute(
                name="user_id", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.RETAIN,
        )

        # Clerk owns auth. The backend only needs the issuer URL to fetch Clerk's
        # public keys (JWKS) for token verification -- no secret. The publishable
        # key is public and lives in the frontend build. Both values are
        # non-sensitive, so they're plain env config here.
        clerk_issuer = "https://mint-chow-13.clerk.accounts.dev"
        frontend_origins = (
            "https://issamna.github.io,"
            "https://ds0s04vkdxys7.cloudfront.net,"
            "http://localhost:5173"
        )

        # User-uploaded recipe photos. Private: the browser reaches it only
        # through presigned URLs the API mints, so no public access and no
        # CloudFront distribution of its own. CORS is needed because uploads go
        # browser -> S3 directly (presigned POST) rather than through Lambda.
        photo_bucket = s3.Bucket(
            self,
            "RecipePhotoBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            removal_policy=RemovalPolicy.RETAIN,
            cors=[
                s3.CorsRule(
                    allowed_methods=[s3.HttpMethods.POST, s3.HttpMethods.GET],
                    allowed_origins=frontend_origins.split(","),
                    allowed_headers=["*"],
                    max_age=3000,
                )
            ],
            lifecycle_rules=[
                s3.LifecycleRule(
                    abort_incomplete_multipart_upload_after=Duration.days(1)
                )
            ],
        )

        entry = Path(__file__).resolve().parent.parent / "src"

        lambda_fn = lambda_python.PythonFunction(
            self,
            "FastApiHandler",
            entry=str(entry),
            index="api.py",
            handler="handler",
            runtime=lambda_.Runtime.PYTHON_3_12,
            # Recipe import fetches and parses external pages; the 3s default is
            # far too short. 29s aligns with the API Gateway integration cap.
            timeout=Duration.seconds(29),
            memory_size=512,
            environment={
                "RECIPE_TABLE": recipe_table.table_name,
                "RECIPE_TAG_TABLE": recipe_tag_table.table_name,
                "INGREDIENT_TABLE": ingredient_table.table_name,
                "MEAL_PLAN_TABLE": meal_plan_table.table_name,
                "SHOPPING_LIST_TABLE": shopping_list_table.table_name,
                "CLERK_ISSUER": clerk_issuer,
                "CLERK_AUTHORIZED_PARTIES": frontend_origins,
                "ALLOWED_ORIGINS": frontend_origins,
                "RECIPE_PHOTO_BUCKET": photo_bucket.bucket_name,
            },
        )

        photo_bucket.grant_read_write(lambda_fn)

        recipe_table.grant_read_write_data(lambda_fn)
        recipe_tag_table.grant_read_write_data(lambda_fn)
        ingredient_table.grant_read_write_data(lambda_fn)
        meal_plan_table.grant_read_write_data(lambda_fn)
        shopping_list_table.grant_read_write_data(lambda_fn)

        apigw = apigateway.LambdaRestApi(
            self,
            "ForkStackEndpoint",
            handler=lambda_fn,
            proxy=True,
            # Account-safety throttle across all methods: caps steady request
            # rate + burst so a runaway/abusive client can't drive Lambda cost
            # or exhaust capacity. This is a global bucket (not per-IP) -- the
            # free option. Per-IP rate limiting would need WAF (~$6/mo fixed),
            # which isn't worth it here; Clerk handles login/bot protection.
            deploy_options=apigateway.StageOptions(
                throttling_rate_limit=25,
                throttling_burst_limit=50,
            ),
        )
