from aws_cdk import (
    Duration,
    Stack,
    aws_lambda as lambda_,
    aws_lambda_python_alpha as lambda_python,
    aws_apigateway as apigateway,
    aws_dynamodb as dynamodb,
    aws_secretsmanager as secretsmanager,
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
                "JWT_SECRET_ARN": jwt_secret.secret_arn,
                "RECAPTCHA_SECRET_ARN": recaptcha_secret.secret_arn,
                "ENFORCE_RECAPTCHA": "false",
                "ALLOWED_ORIGINS": "https://issamna.github.io,http://localhost:4200",
            },
        )

        recipe_table.grant_read_write_data(lambda_fn)
        user_table.grant_read_write_data(lambda_fn)
        recipe_tag_table.grant_read_write_data(lambda_fn)
        ingredient_table.grant_read_write_data(lambda_fn)
        jwt_secret.grant_read(lambda_fn)
        recaptcha_secret.grant_read(lambda_fn)

        apigw = apigateway.LambdaRestApi(
            self,
            "ForkStackEndpoint",
            handler=lambda_fn,
            proxy=True,
        )
