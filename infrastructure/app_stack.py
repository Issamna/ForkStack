from aws_cdk import (
    Duration,
    Stack,
    aws_lambda as lambda_,
    aws_lambda_python_alpha as lambda_python,
    aws_apigateway as apigateway,
    aws_dynamodb as dynamodb,
    aws_secretsmanager as secretsmanager,
    aws_wafv2 as wafv2,
    RemovalPolicy,
)
from constructs import Construct
from pathlib import Path


class AppStack(Stack):
    def __init__(self, scope: Construct, id: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        user_table = dynamodb.Table(
            self,
            "UserTable",
            partition_key=dynamodb.Attribute(
                name="user_id", type=dynamodb.AttributeType.STRING
            ),
            table_name="UserTable",
            removal_policy=RemovalPolicy.DESTROY,
        )

        recipe_table = dynamodb.Table(
            self,
            "RecipeTable",
            partition_key=dynamodb.Attribute(
                name="recipe_id", type=dynamodb.AttributeType.STRING
            ),
        )
        recipe_tag_table = dynamodb.Table(
            self,
            "RecipeTagTable",
            partition_key=dynamodb.Attribute(
                name="id", type=dynamodb.AttributeType.STRING
            ),
        )
        ingredient_table = dynamodb.Table(
            self,
            "IngredientTable",
            partition_key=dynamodb.Attribute(
                name="ingredient_id", type=dynamodb.AttributeType.STRING
            ),
            removal_policy=RemovalPolicy.RETAIN,
        )
        meal_plan_table = dynamodb.Table(
            self,
            "MealPlanTable",
            partition_key=dynamodb.Attribute(
                name="user_id", type=dynamodb.AttributeType.STRING
            ),
            removal_policy=RemovalPolicy.RETAIN,
        )
        shopping_list_table = dynamodb.Table(
            self,
            "ShoppingListTable",
            partition_key=dynamodb.Attribute(
                name="user_id", type=dynamodb.AttributeType.STRING
            ),
            removal_policy=RemovalPolicy.RETAIN,
        )

        # JWT signing key -- auto-generated, never checked into source.
        jwt_secret = secretsmanager.Secret(
            self,
            "JwtSecret",
            description="ForkStack JWT signing key",
            generate_secret_string=secretsmanager.SecretStringGenerator(
                password_length=48,
                exclude_punctuation=True,
            ),
        )

        # reCAPTCHA v3 server secret -- placeholder; populate with the real key
        # via `aws secretsmanager put-secret-value` before enabling enforcement.
        recaptcha_secret = secretsmanager.Secret(
            self,
            "RecaptchaSecret",
            secret_name="forkstack/recaptcha",
            description="ForkStack reCAPTCHA v3 secret key",
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
                "USER_TABLE": user_table.table_name,
                "RECIPE_TAG_TABLE": recipe_tag_table.table_name,
                "INGREDIENT_TABLE": ingredient_table.table_name,
                "MEAL_PLAN_TABLE": meal_plan_table.table_name,
                "SHOPPING_LIST_TABLE": shopping_list_table.table_name,
                "JWT_SECRET_ARN": jwt_secret.secret_arn,
                "RECAPTCHA_SECRET_ARN": recaptcha_secret.secret_arn,
                # PREREQUISITE: the reCAPTCHA v3 server secret must be populated
                # (`aws secretsmanager put-secret-value --secret-id
                # forkstack/recaptcha --secret-string <key>`) BEFORE deploying
                # this. With enforcement on and no secret, registration returns
                # 500. The frontend site key is already wired in app.module.ts.
                "ENFORCE_RECAPTCHA": "true",
                "ALLOWED_ORIGINS": "https://issamna.github.io,https://ds0s04vkdxys7.cloudfront.net,http://localhost:4200",
            },
        )

        recipe_table.grant_read_write_data(lambda_fn)
        user_table.grant_read_write_data(lambda_fn)
        recipe_tag_table.grant_read_write_data(lambda_fn)
        ingredient_table.grant_read_write_data(lambda_fn)
        meal_plan_table.grant_read_write_data(lambda_fn)
        shopping_list_table.grant_read_write_data(lambda_fn)
        jwt_secret.grant_read(lambda_fn)
        recaptcha_secret.grant_read(lambda_fn)

        apigw = apigateway.LambdaRestApi(
            self,
            "ForkStackEndpoint",
            handler=lambda_fn,
            proxy=True,
            # Coarse account-safety throttle across all methods: caps steady
            # request rate + burst so a runaway client can't drive Lambda cost
            # or exhaust capacity. Per-IP abuse is handled by the WAF below.
            deploy_options=apigateway.StageOptions(
                throttling_rate_limit=25,
                throttling_burst_limit=50,
            ),
        )

        # Per-IP rate limiting (brute-force / scraping defense). A rate-based
        # rule blocks a source IP that exceeds the limit within a 5-minute
        # window; everything else is allowed through.
        web_acl = wafv2.CfnWebACL(
            self,
            "ApiWebAcl",
            scope="REGIONAL",
            default_action=wafv2.CfnWebACL.DefaultActionProperty(allow={}),
            visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                cloud_watch_metrics_enabled=True,
                metric_name="ForkStackApiWebAcl",
                sampled_requests_enabled=True,
            ),
            rules=[
                wafv2.CfnWebACL.RuleProperty(
                    name="RateLimitPerIp",
                    priority=1,
                    action=wafv2.CfnWebACL.RuleActionProperty(block={}),
                    statement=wafv2.CfnWebACL.StatementProperty(
                        rate_based_statement=wafv2.CfnWebACL.RateBasedStatementProperty(
                            limit=1000,  # requests per IP per 5 min
                            aggregate_key_type="IP",
                        ),
                    ),
                    visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                        cloud_watch_metrics_enabled=True,
                        metric_name="RateLimitPerIp",
                        sampled_requests_enabled=True,
                    ),
                ),
            ],
        )

        wafv2.CfnWebACLAssociation(
            self,
            "ApiWebAclAssociation",
            resource_arn=(
                f"arn:aws:apigateway:{self.region}::/restapis/"
                f"{apigw.rest_api_id}/stages/{apigw.deployment_stage.stage_name}"
            ),
            web_acl_arn=web_acl.attr_arn,
        )
