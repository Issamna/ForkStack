
# 🍲 Personal Recipe App with FastAPI + AWS (CDK-first Architecture)

A personal online cookbook app where a user can enter recipes (ingredients, quantities, instructions), view them, print them as PDFs, and email them — built using **FastAPI** and deployed with **AWS CDK** to learn both backend development and AWS Developer skills.

---

## 🎯 Project Goalsa
- Recipe entry & view
- PDF generation & email
- FastAPI backend
- React frontend
- AWS backend (Lambda, API Gateway, DynamoDB, S3, SES)
- Use AWS CDK (Python) as primary infrastructure-as-code tool

---

## 🧱 AWS Infrastructure Overview

| Component    | AWS Service           | Purpose                                   |
|--------------|------------------------|-------------------------------------------|
| API          | Lambda + FastAPI       | Backend logic via serverless functions     |
| API Gateway  | API Gateway            | Expose API routes publicly                 |
| DB           | DynamoDB               | Store recipes (NoSQL)                      |
| File Storage | S3                     | Store generated PDFs                       |
| Email        | SES                    | Send recipe PDFs via email                |
| Permissions  | IAM Roles              | Secure access between services             |
| Deployment   | AWS CDK (Python)       | Infrastructure as code                     |

---

## 🛠 Action Plan

### ✅ Step 0: Environment Setup
- [ ] Install AWS CLI, configure `aws configure`
- [ ] Install Node.js and CDK: `npm install -g aws-cdk`
- [ ] Set up Python venv
- [ ] `cdk bootstrap`
- [ ] `cdk init app --language python`

---

### ✅ Step 1: Basic FastAPI App
- [ ] Create FastAPI app with recipe CRUD routes
- [ ] Wrap with `Mangum` for Lambda compatibility

---

### ✅ Step 2: Deploy API with CDK
- [ ] Create CDK Lambda resource
- [ ] Create CDK API Gateway resource
- [ ] Connect FastAPI to API Gateway
- [ ] Deploy: `cdk deploy`

---

### ✅ Step 3: Add DynamoDB
- [ ] Define `recipes` table in CDK
- [ ] Give Lambda read/write permissions
- [ ] Use `boto3` or `aioboto3` to interact in FastAPI

---

### ✅ Step 4: Generate PDFs
- [ ] Add endpoint `/recipes/{id}/pdf`
- [ ] Use `WeasyPrint`, `pdfkit`, or `reportlab`
- [ ] Upload to S3 and return link

---

### ✅ Step 5: Email PDF via SES
- [ ] Set up SES + verify email in console
- [ ] Use `boto3` to send email with attached PDF or S3 link

---

### ✅ Step 6: React Frontend
- [ ] Form to create recipes
- [ ] List to view them
- [ ] Buttons to download/email PDF

---

### ✅ Step 7: (Optional) Authentication
- [ ] Add token-based access (simple or Cognito-based)

---

## 🔧 Tools

Install in Python env:

```bash
pip install fastapi mangum boto3 weasyprint
```

CDK Project:

```bash
pip install aws-cdk-lib constructs aws-cdk.aws-lambda-python-alpha
```

---

## 🎓 What You’ll Learn (AWS Developer Topics)

| Skill              | Service         |
|-------------------|-----------------|
| Serverless APIs    | Lambda + API Gateway |
| NoSQL Data         | DynamoDB        |
| Storage            | S3              |
| Email              | SES             |
| IAM                | Roles & policies |
| Deployment         | CDK (Python)    |
| Monitoring         | CloudWatch      |