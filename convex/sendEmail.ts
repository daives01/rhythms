"use node"

import { action } from "./_generated/server"
import { v } from "convex/values"
import { Resend } from "resend"

export const sendEmail = action({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const resendApiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.EMAIL_FROM

    if (!resendApiKey || !fromEmail) {
      console.log(`[DEV EMAIL] To: ${args.to}\nSubject: ${args.subject}\n${args.html}`)
      const urlMatch = args.html.match(/href="([^"]+)"/)
      if (urlMatch) {
        console.log(`[DEV EMAIL LINK] ${urlMatch[1]}`)
      }
      return null
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
