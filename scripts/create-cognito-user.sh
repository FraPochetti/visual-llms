#!/bin/bash

# Script to create a user in AWS Cognito User Pool
# This creates an admin user that can log into Visual Neurons

set -e

echo "==================================="
echo "Visual Neurons - Create Cognito User"
echo "==================================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI is not installed."
    echo "Install it with: sudo apt install awscli"
    echo "Then configure with: aws configure"
    exit 1
fi

# Check if AWS is configured
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS CLI is not configured."
    echo "Run: aws configure"
    echo "You'll need:"
    echo "  - AWS Access Key ID"
    echo "  - AWS Secret Access Key"
    echo "  - Default region (e.g., us-east-1)"
    exit 1
fi

# Prompt for User Pool ID if not provided
if [ -z "$1" ]; then
    echo "Enter your Cognito User Pool ID (e.g., us-east-1_XXXXXXXXX):"
    read -r USER_POOL_ID
else
    USER_POOL_ID=$1
fi

# Validate User Pool ID format
if [[ ! $USER_POOL_ID =~ ^[a-z]+-[a-z]+-[0-9]+_[A-Za-z0-9]+$ ]]; then
    echo "Error: Invalid User Pool ID format"
    echo "Expected format: us-east-1_XXXXXXXXX"
    exit 1
fi

# Prompt for username
echo ""
echo "Enter username for the new user:"
read -r USERNAME

if [ -z "$USERNAME" ]; then
    echo "Error: Username cannot be empty"
    exit 1
fi

# Prompt for temporary password
echo ""
echo "Enter a temporary password (user will be required to change it on first login):"
echo "Requirements: At least 8 characters, with uppercase, lowercase, numbers, and special characters"
read -s TEMP_PASSWORD
echo ""

if [ -z "$TEMP_PASSWORD" ]; then
    echo "Error: Password cannot be empty"
    exit 1
fi

# Confirm
echo ""
echo "Creating user with the following details:"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Username: $USERNAME"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Create the user
echo ""
echo "Creating user..."

aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$USERNAME" \
    --temporary-password "$TEMP_PASSWORD" \
    --message-action SUPPRESS \
    2>&1

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ User created successfully!"
    echo ""
    echo "Login credentials:"
    echo "  Username: $USERNAME"
    echo "  Temporary Password: [hidden]"
    echo ""
    echo "Next steps:"
    echo "1. Go to https://visualneurons.com/login"
    echo "2. Enter the username and temporary password"
    echo "3. You'll be prompted to set a new password"
    echo ""
else
    echo ""
    echo "✗ Failed to create user"
    echo "Check the error message above for details"
    exit 1
fi

