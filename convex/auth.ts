import { createClient, type GenericCtx } from "@convex-dev/better-auth"
import { convex, crossDomain } from "@convex-dev/better-auth/plugins"
import { betterAuth, type BetterAuthOptions } from "better-auth/minimal"
import { username } from "better-auth/plugins"
import { render } from "@react-email/render"
import { createElement } from "react"
import { components } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import authConfig from "./auth.config"
import { buildAppUserSyncChange } from "./auth-user-sync"
import ResetPasswordEmail from "./emails/ResetPasswordEmail"
import VerifyEmail from "./emails/VerifyEmail"

const siteUrl = process.env.SITE_URL
if (!siteUrl) {
  throw new Error("SITE_URL is required for Better Auth.")
}

const clientUrl = process.env.CLIENT_URL

const replaceUrlOrigin = (url: string, origin?: string) => {
  if (!origin) {
    return url
  }

  const match = origin.match(/^(https?:)\/\/([^/]+)/i)
  if (!match) {
    return url
  }

  const [, protocol, host] = match
  return url.replace(/^[a-z]+:\/\/[^/]+/i, `${protocol}//${host}`)
}
export const authComponent = createClient<DataModel>(components.betterAuth, {
  verbose: false,
})

type AppUserDb = {
  query: (table: "users") => {
    withIndex: (
      index: "by_authUserId",
      cb: (q: { eq: (field: "authUserId", value: string) => unknown }) => unknown
    ) => {
      unique: () => Promise<{ _id: string; email?: string; name?: string } | null>
    }
  }
  insert: (
    table: "users",
    value: {
      authUserId: string
      email?: string
      name?: string
      premium: boolean
      createdAt: number
    }
  ) => Promise<unknown>
  patch: (id: string, value: { email?: string; name?: string }) => Promise<void>
}

const syncAppUser = async (
  ctx: GenericCtx<DataModel>,
  authUser: { id: string; email?: string | null; name?: string | null }
) => {
  const db = (ctx as { db?: AppUserDb }).db
  if (!db) {
    return
  }
  const existing = await db
    .query("users")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUser.id))
    .unique()
  const change = buildAppUserSyncChange(existing, authUser)

  if (change.kind === "insert") {
    await db.insert("users", change.value)
    return
  }

  if (change.kind === "patch") {
    await db.patch(change.userId, change.value)
  }
}

export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
  ({
    baseURL: siteUrl,
    trustedOrigins: [siteUrl, ...(clientUrl ? [clientUrl] : [])],
    database: authComponent.adapter(ctx),
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    plugins: [crossDomain({ siteUrl: clientUrl || siteUrl }), convex({ authConfig }), username()],
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await syncAppUser(ctx, user)
          },
        },
        update: {
          after: async (user) => {
            await syncAppUser(ctx, user)
          },
        },
      },
      session: {
        create: {
          after: async (session, context) => {
            const authUser = await context?.context.internalAdapter.findUserById(session.userId)
            if (authUser) {
              await syncAppUser(ctx, authUser)
            }
          },
        },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      sendResetPassword: async ({ user, url }) => {
        const actionUrl = replaceUrlOrigin(url, clientUrl)
        const html = await render(
          createElement(ResetPasswordEmail, {
            resetUrl: actionUrl,
            clientUrl,
            supportEmail: process.env.SUPPORT_EMAIL,
          })
        )
        await (ctx as { runAction: (path: string, args: unknown) => Promise<unknown> }).runAction(
          "sendEmail:sendEmail",
          {
            to: user.email,
            subject: "Reset your password",
            html,
          }
        )
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const actionUrl = replaceUrlOrigin(url, clientUrl)
        const html = await render(
          createElement(VerifyEmail, {
            verificationUrl: actionUrl,
            clientUrl,
            supportEmail: process.env.SUPPORT_EMAIL,
          })
        )
        await (ctx as { runAction: (path: string, args: unknown) => Promise<unknown> }).runAction(
          "sendEmail:sendEmail",
          {
            to: user.email,
            subject: "Verify your email",
            html,
          }
        )
      },
    },
  }) satisfies BetterAuthOptions

export const createAuth = (ctx: GenericCtx<DataModel>) => betterAuth(createAuthOptions(ctx))
