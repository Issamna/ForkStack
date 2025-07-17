from aws_cdk import (
    Stack,
    aws_lambda as lambda_,
    aws_lambda_python_alpha as lambda_python,
    aws_apigateway as apigateway,
    aws_dynamodb as dynamodb,
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

        entry = Path(__file__).resolve().parent.parent / "src"

        lambda_fn = lambda_python.PythonFunction(
            self,
            "FastApiHandler",
            entry=str(entry),
            index="api.py",
            handler="handler",
            runtime=lambda_.Runtime.PYTHON_3_12,
            environment={
                "RECIPE_TABLE": recipe_table.table_name,
                "USER_TABLE": user_table.table_name,
                "RECIPE_TAG_TABLE": recipe_tag_table.table_name,
            },
        )

        recipe_table.grant_read_write_data(lambda_fn)
        user_table.grant_read_write_data(lambda_fn)
        recipe_tag_table.grant_read_write_data(lambda_fn)

        apigw = apigateway.LambdaRestApi(
            self,
            "ForkStackEndpoint",
            handler=lambda_fn,
            proxy=True,
        )
