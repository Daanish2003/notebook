# The tailnet is the security boundary; no app-level auth

Notebook is single-owner and runs on the owner's Omarchy machine. The server listens only on localhost and is reached only through `tailscale serve`, never `tailscale funnel`. Any device on the owner's tailnet is therefore already authenticated, so the app has no login, sessions, or user table. If it is ever made public, auth is added then, as part of that effort. Better Auth was removed for this reason, not overlooked.
