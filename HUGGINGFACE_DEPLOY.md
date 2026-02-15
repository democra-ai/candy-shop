# Deploying Candy Shop to Hugging Face Spaces

This guide explains how to deploy the Candy Shop application to Hugging Face Spaces using Docker.

## Prerequisites

- A [Hugging Face account](https://huggingface.co/join)
- [Git](https://git-scm.com/) installed
- [Docker](https://www.docker.com/) installed (optional, for local testing)

## Steps

### 1. Create a New Space

1.  Go to [Hugging Face Spaces](https://huggingface.co/spaces) and click **Create new Space**.
2.  **Space name**: `candy-shop` (or any name you prefer).
3.  **License**: Choose a license (e.g., MIT).
4.  **SDK**: Select **Docker**.
5.  **Template**: Keep as **Blank**.
6.  **Space hardware**: **CPU Basic (Free)** is sufficient.
7.  Click **Create Space**.

### 2. Prepare Your Code (Already Done)

We have already:
- Updated `vite.config.ts` to support the Spaces environment.
- Created a `Dockerfile` to build and serve the application.
- Created a `.dockerignore` file.

### 3. Push to Hugging Face

You can push your code to the Space using Git.

1.  **Clone the Space repository** locally:
    ```bash
    git clone https://huggingface.co/spaces/YOUR_USERNAME/candy-shop
    ```
    *(Replace `YOUR_USERNAME` with your actual Hugging Face username)*

2.  **Copy project files** into the cloned directory:
    - Copy all files from your current project to the cloned `candy-shop` directory.
    - **Note**: Ensure you copy the `.env` (if needed) and hidden files/folders (except `.git`).

    *Alternatively, you can just add the Space as a remote to your existing repo:*
    ```bash
    git remote add space https://huggingface.co/spaces/YOUR_USERNAME/candy-shop
    git push space main
    ```
    *(Note: You might need to force push or pull --rebase if the Space was initialized with a README)*

3.  **Commit and Push**:
    ```bash
    git add .
    git commit -m "Initial deployment to Spaces"
    git push
    ```

### 4. Continuous Deployment (Optional)

You can also set up GitHub Actions to automatically push to Hugging Face Spaces whenever you push to your GitHub repository.

See [Sync with GitHub Actions](https://huggingface.co/docs/hub/spaces-github-actions) for details.

## Troubleshooting

- **Build Logs**: Check the "Logs" tab in your Space to see the build progress and any errors.
- **Port**: Docker containers on Spaces must listen on port `7860`. Our `Dockerfile` ensures this.
- **Environment Variables**: If your app needs environment variables, go to **Settings** > **Variables and secrets** in your Space to add them.
