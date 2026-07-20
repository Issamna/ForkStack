from aws_cdk import (
    CfnOutput,
    Duration,
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
    """S3 + CloudFront hosting for the React frontend.

    Mirror of the GitHub Pages site so the app stays reachable independent of
    GitHub's Pages deployment pipeline. Built from web/dist-cloudfront (Vite
    build with base "/").
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

        # Security response headers. The four standard headers are enforced;
        # the CSP is sent Report-Only (violations logged in the browser console,
        # nothing blocked) so it can be tuned against the real app before being
        # promoted to an enforcing Content-Security-Policy. NB: these apply only
        # to the CloudFront copy -- the primary GitHub Pages deployment can't set
        # custom response headers.
        # Clerk loads its JS from and talks to the instance's Frontend API
        # (*.clerk.accounts.dev for a dev instance) and renders components in a
        # worker/iframe, so those origins are allowed for script/connect/frame/
        # worker/img. The API Gateway origin is allowed for connect.
        clerk = "https://*.clerk.accounts.dev"
        api = "https://e6q9keyixh.execute-api.us-east-1.amazonaws.com"
        csp = (
            "default-src 'self'; "
            f"script-src 'self' 'unsafe-eval' {clerk}; "
            "style-src 'self' 'unsafe-inline'; "
            f"img-src 'self' data: {clerk} https://img.clerk.com; "
            "font-src 'self'; "
            f"connect-src 'self' {api} {clerk}; "
            f"worker-src 'self' blob:; "
            f"frame-src 'self' {clerk}; "
            "object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
        )
        security_headers = cloudfront.ResponseHeadersPolicy(
            self,
            "SecurityHeaders",
            security_headers_behavior=cloudfront.ResponseSecurityHeadersBehavior(
                content_type_options=cloudfront.ResponseHeadersContentTypeOptions(
                    override=True
                ),
                frame_options=cloudfront.ResponseHeadersFrameOptions(
                    frame_option=cloudfront.HeadersFrameOption.DENY, override=True
                ),
                referrer_policy=cloudfront.ResponseHeadersReferrerPolicy(
                    referrer_policy=cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
                    override=True,
                ),
                strict_transport_security=cloudfront.ResponseHeadersStrictTransportSecurity(
                    access_control_max_age=Duration.days(365),
                    include_subdomains=True,
                    override=True,
                ),
            ),
            custom_headers_behavior=cloudfront.ResponseCustomHeadersBehavior(
                custom_headers=[
                    cloudfront.ResponseCustomHeader(
                        header="Content-Security-Policy-Report-Only",
                        value=csp,
                        override=True,
                    ),
                ],
            ),
        )

        distribution = cloudfront.Distribution(
            self,
            "FrontendDistribution",
            default_behavior=cloudfront.BehaviorOptions(
                origin=origins.S3BucketOrigin.with_origin_access_control(bucket),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                response_headers_policy=security_headers,
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

        dist_dir = Path(__file__).parent.parent / "web" / "dist-cloudfront"
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
