from aws_cdk import (
    CfnOutput,
    RemovalPolicy,
    Stack,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_s3 as s3,
    aws_s3_deployment as s3_deployment,
)
from constructs import Construct
from pathlib import Path


class FrontendStack(Stack):
    """S3 + CloudFront hosting for the Angular frontend.

    Mirror of the GitHub Pages site so the app stays reachable independent of
    GitHub's Pages deployment pipeline. Built from
    forkstack-frontend/dist-cloudfront (base-href "/").
    """

    def __init__(self, scope: Construct, id: str, **kwargs):
        super().__init__(scope, id, **kwargs)

        bucket = s3.Bucket(
            self,
            "FrontendBucket",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        distribution = cloudfront.Distribution(
            self,
            "FrontendDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            ),
            default_root_object="index.html",
            price_class=cloudfront.PriceClass.PRICE_CLASS_100,
            error_responses=[
                # SPA fallback: deep links hit S3 as missing keys (403/404) and
                # must serve the app shell instead.
                cloudfront.ErrorResponse(
                    http_status=403,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
                cloudfront.ErrorResponse(
                    http_status=404,
                    response_http_status=200,
                    response_page_path="/index.html",
                ),
            ],
        )

        dist_dir = (
            Path(__file__).parent.parent / "forkstack-frontend" / "dist-cloudfront"
        )
        s3_deployment.BucketDeployment(
            self,
            "FrontendDeployment",
            sources=[s3_deployment.Source.asset(str(dist_dir))],
            destination_bucket=bucket,
            distribution=distribution,
            distribution_paths=["/*"],
            # Default 128MB OOMs on our image-heavy bundle.
            memory_limit=512,
        )

        CfnOutput(self, "FrontendURL", value=f"https://{distribution.domain_name}")
