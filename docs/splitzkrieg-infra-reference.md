# Splitzkrieg Azure & Infrastructure Reference

## Azure SQL Database
- **Server:** splitzkrieg-sql.database.windows.net
- **Database:** SplitzkriegDB
- **Resource Group:** splitzkrieg-rg
- **Region:** North Central US
- **Tier:** General Purpose - Serverless (Standard-series Gen5, 2 vCores, 32GB)
- **Cost:** Free tier (32GB storage, 100,000 vCore seconds/month)
- **Auth:** SQL authentication (admin credentials stored separately)
- **Auto-pause:** Enabled (first query after idle takes 30-60s to wake)
- **Schema:** 14 tables, 2 views, 1 function (fn_RollingAverage — needs fix), 6 computed columns on scores
- **Data:** 22,817 scores, 619 bowlers, 42 teams, 35 seasons (as of March 2026)

## Domain
- **Domain:** splitzkrieg.org (registered)

## Planned Hosting
- **Frontend:** Vercel (free tier, deploy from GitHub)
- **Backend:** Next.js API routes (same Vercel deployment)
- **Database:** Azure SQL (as above)
- **npm package for SQL connection:** mssql

## VS Code Setup
- Extension: SQL Server (mssql)
- Profile: SPLITZKRIEG-PERSONAL (separate from BASEHIT-WORK)
- Always run `SELECT DB_NAME()` if uncertain which database is active

## GitHub
- Repo not yet created
- Next step: create repo, initialize Next.js project, install GSD
