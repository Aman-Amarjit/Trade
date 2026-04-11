# Security Policy

## Security Measures

This project implements several layers of security to protect data and intellectual property.

### 1. Network & API Security
- **Helmet**: Secure HTTP headers are applied to all API responses to prevent common web vulnerabilities (XSS, Clickjacking, MIME-sniffing).
- **CORS**: Strict Cross-Origin Resource Sharing policy limits API access to authorized domains.
- **Rate Limiting**: Per-client rate limiting prevents Denial of Service (DoS) and brute-force attacks.
- **Bearer Authentication**: Sensitive endpoints require a strong `API_TOKEN`.

### 2. Data Protection
- **Input Sanitization**: All query parameters are sanitized to prevent log injection and oversized input attacks.
- **OHLCV Validation**: Market data is validated for integrity before processing.
- **Environment Variables**: Sensitive configuration (tokens, ports) is managed via environment variables and never committed to version control.

### 3. Intellectual Property
- **Backend Isolation**: Proprietary trading logic and engines reside exclusively on the server.
- **Frontend Minification**: Client-side code is minified to make reverse-engineering difficult.
- **License**: The software is proprietary and protected by an "All Rights Reserved" license.

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please report it via the following process:

1. **Email the maintainer** at security@example.com (replace with actual email).
2. **Do not disclose the vulnerability publicly** until a fix has been released.
3. Provide a detailed summary, including steps to reproduce the issue.

We will acknowledge your report within 48 hours and provide a timeline for resolution.
