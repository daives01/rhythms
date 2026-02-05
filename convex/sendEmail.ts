"use node"

import { internalAction } from "./_generated/server"
import { v } from "convex/values"
import { Resend } from "resend"

export const sendEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.EMAIL_FROM

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is required to send emails.")
    }

    if (!fromEmail) {
      throw new Error("EMAIL_FROM is required to send emails.")
    }

    const resend = new Resend(resendApiKey)
    const trimmedFromEmail = fromEmail.trim()
    if (!trimmedFromEmail) {
      throw new Error("EMAIL_FROM is required to send emails.")
    }
    await resend.emails.send({
      from: trimmedFromEmail,
      to: args.to,
      subject: args.subject,
      html: args.html,
    })
    return null
  },
})
