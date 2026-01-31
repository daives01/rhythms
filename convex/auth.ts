import { createClient, type GenericCtx } from "@convex-dev/better-auth"
import { convex, crossDomain } from "@convex-dev/better-auth/plugins"
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal"
import { username } from "better-auth/plugins"
import { components } from "./_generated/api"
import { DataModel } from "./_generated/dataModel"
import authConfig from "./auth.config"

const siteUrl = process.env.SITE_URL
if (!siteUrl) {
  throw new Error("SITE_URL is required for Better Auth.")
}

const clientUrl = process.env.CLIENT_URL
export const authComponent = createClient<DataModel>(components.betterAuth, {
  verbose: false,
})

export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    baseURL: siteUrl,
    trustedOrigins: [siteUrl, ...(clientUrl ? [clientUrl] : [])],
    database: authComponent.adapter(ctx),
    plugins: [crossDomain({ siteUrl: clientUrl || siteUrl }), convex({ authConfig }), username()],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        await (ctx as { runAction: (path: string, args: unknown) => Promise<unknown> }).runAction(
          "sendEmail",
          {
            to: user.email,
            subject: "Reset your password",
            html: `<p>Click the link to reset your password:</p><p><a href="${url}">${url}</a></p>`,
          }
        )
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await (ctx as { runAction: (path: string, args: unknown) => Promise<unknown> }).runAction(
          "sendEmail",
          {
            to: user.email,
            subject: "Verify your email",
            html: `<p>Click the link to verify your email:</p><p><a href="${url}">${url}</a></p>`,
          }
        )
      },
    },
  }) satisfies BetterAuthOptions

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx))
