import aws_cdk as core
import aws_cdk.assertions as assertions

from infrastructure.app_stack import AppStack

# example tests. To run these tests, uncomment this file along with the example
# resource in forkstack/forkstack_stack.py
def test_sqs_queue_created():
    app = core.App()
    stack = AppStack(app, "forkstack")
    template = assertions.Template.from_stack(stack)

#     template.has_resource_properties("AWS::SQS::Queue", {
#         "VisibilityTimeout": 300
#     })
