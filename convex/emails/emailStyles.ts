import type { CSSProperties } from "react"

export const colors = {
  background: "#0a0a0a",
  panel: "#1a1a1a",
  primary: "#ffffff",
  secondary: "#b0b0b0",
  accent: "#e0e0e0",
  accentMuted: "#2a2a2a",
  border: "#2a2a2a",
}

export const typography = {
  fontFamily:
    "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
}

export const layout: Record<string, CSSProperties> = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: colors.background,
    fontFamily: typography.fontFamily,
  },
  container: {
    width: "100%",
    maxWidth: "600px",
    margin: "0 auto",
    padding: "32px 20px 48px",
  },
  panel: {
    backgroundColor: colors.panel,
    borderRadius: "0px",
    border: `1px solid ${colors.border}`,
    padding: "28px",
  },
  pill: {
    display: "inline-block",
    padding: "6px 12px",
    borderRadius: "0px",
    backgroundColor: colors.accentMuted,
    color: colors.primary,
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  heading: {
    color: colors.primary,
    fontSize: "20px",
    fontWeight: 700,
    lineHeight: "26px",
    margin: "16px 0 12px",
  },
  text: {
    color: colors.secondary,
    fontSize: "15px",
    lineHeight: "22px",
    margin: "0 0 16px",
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: "0px",
    color: "#0a0a0a",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: 700,
    padding: "12px 18px",
    textDecoration: "none",
    textAlign: "center",
    border: `1px solid ${colors.accent}`,
    boxSizing: "border-box",
  },
  divider: {
    borderColor: colors.border,
    margin: "24px 0",
  },
  smallText: {
    color: colors.secondary,
    fontSize: "13px",
    lineHeight: "20px",
    margin: "0 0 12px",
  },
  footer: {
    marginTop: "24px",
    color: colors.secondary,
    fontSize: "12px",
    lineHeight: "18px",
  },
}
