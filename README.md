# FAIRWORK — Blockchain-Backed Freelance Escrow

## Project Architecture

This repository uses Next.js (App Router), Hardhat, and SQLite to run the Fairwork platform.

### Folder Structure
- `/src/app`: Next.js frontend routes and API endpoints.
- `/src/components`: Reusable React components and UI.
- `/src/lib/contracts`: Canonical agreement encoding and hashing utilities.
- `/src/lib/storage`: Evidence storage and verification logic.
- `/src/lib/db`: SQLite read model and reconciliation logic.
- `/src/lib/indexer`: Blockchain event ingestion logic.
- `/src/lib/env`: Environment variable validation using Zod.
- `/contracts`: Solidity source code for the platform.
- `/scripts`: Hardhat deployment scripts.
- `/test`: Contract tests and test fixtures.

## Environments

### Local Development
The default setup uses a local Hardhat node (Chain ID 31337). This network provides deterministic testing conditions and fake funds.
- To run the local node: `npx hardhat node`
- Deploy to local node: `npx hardhat run scripts/deploy.ts --network localhost`

### Sepolia Testnet
We use the actual Sepolia network for public deployment. We DO NOT silently switch networks. If Sepolia is required, ensure your `.env` contains valid credentials.
- Deploy to Sepolia: `npx hardhat run scripts/deploy.ts --network sepolia`

## Setup Instructions
1. Run `npm install`
2. Copy `.env.example` to `.env` and fill in required values (do not commit!).
3. Run `npx hardhat compile` to compile contracts.
4. Run `npm run dev` to start the local Next.js server.

## Scripts
- `npm run lint`: Lint the project.
- `npm run check`: Type-check the Next.js project.
- `npm run build`: Build the production frontend.
- `npx hardhat test`: Run smart contract tests.
