# Governance

## Overview

Akari is an open-source project. We believe in a transparent, fair, and community-driven decision-making process. 

This document outlines how decisions are made, how contributors can become maintainers, and how conflicts are resolved.

## Roles

### 1. Users
Anyone who uses Akari, asks questions, or reports bugs. Users are the most important part of the project. We value your feedback.

### 2. Contributors
Anyone who has submitted a Pull Request that was merged, or significantly improved the documentation. Contributors are listed in the project's release notes.

### 3. Maintainers
Maintainers are contributors who have shown a long-term commitment to the project. They have write access to the repository and can merge Pull Requests. They are responsible for:
- Reviewing pull requests.
- Triaging issues.
- Guiding new contributors.
- Maintaining the quality and security of the codebase.

### 4. Lead Maintainer (BDFL)
Currently, the project is led by its creator, **Quentin (HvK Okla)**, acting as a *Benevolent Dictator For Life* (BDFL). 
The Lead Maintainer has the final say on architectural decisions, the direction of the language, and the security model.

## How to become a Maintainer

We don't have a formal application process. Maintainership is earned through consistent, high-quality contributions and a positive attitude.

To become a maintainer, you typically need to:
1. Have 5+ Pull Requests merged (code, docs, or tests).
2. Demonstrate a deep understanding of the architecture and security model.
3. Be active in the community (reviewing code, helping others).
4. Be nominated by an existing Maintainer and approved by the Lead Maintainer.

## Decision Making

### Minor Changes (Bug fixes, docs, small features)
- Decided by Maintainers through the Pull Request review process.
- Consensus is preferred.

### Major Changes (New syntax, breaking changes, new backends)
- Must be discussed in a GitHub Issue or RFC (Request for Comments).
- Require approval from the Lead Maintainer.

### Security Fixes
- Security vulnerabilities are handled privately (see [SECURITY.md](SECURITY.md)).
- The Lead Maintainer has absolute authority to push critical security patches without prior discussion.

## The Core Philosophy (Our "Constitution")

All decisions must respect the following rules:
1. **Safe by default**: No feature will be added if it compromises the sandbox.
2. **Small by design**: The language will never have more than 20 keywords. Simplicity is a feature.
3. **Zero dependencies**: The core engine must never require external npm packages.
4. **Developer Experience**: We prioritize clear error messages and good documentation.

## Conflict Resolution

If two Maintainers disagree, they should discuss it respectfully in the issue/PR thread. If a consensus cannot be reached, the Lead Maintainer makes the final decision.

## Code of Conduct

All members of the community (Users, Contributors, Maintainers) must adhere to our [Code of Conduct](CODE_OF_CONDUCT.md). We do not tolerate harassment, gatekeeping, or condescension.