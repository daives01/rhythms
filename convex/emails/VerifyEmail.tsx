import { Body, Button, Container, Head, Html, Hr, Preview, Section, Text } from "@react-email/components"
import { colors, layout } from "./emailStyles"

interface VerifyEmailProps {
  verificationUrl: string
  clientUrl?: string
  supportEmail?: string
}

const VerifyEmail = ({ verificationUrl, clientUrl, supportEmail }: VerifyEmailProps) => {
  const appUrl = clientUrl ?? "https://rhythms.daniel-ives.com"

  return (
    <Html lang="en">
      <Head />
      <Preview>Verify your Rhythms email address</Preview>
      <Body style={layout.body}>
        <Container style={layout.container}>
          <Section style={layout.panel}>
            <Text style={layout.pill}>Welcome to Rhythms</Text>
            <Text style={layout.heading}>Verify your email</Text>
            <Text style={layout.text}>
              Thanks for signing up. Confirm this is your email address and we will get your account ready.
            </Text>
            <Button href={verificationUrl} style={layout.button}>
              Verify email
            </Button>
            <Text style={{ ...layout.smallText, marginTop: "16px" }}>
              If the button does not work, copy and paste this link into your browser:
            </Text>
            <Text style={{ ...layout.smallText, wordBreak: "break-all", color: colors.accent }}>
              {verificationUrl}
            </Text>
            <Hr style={layout.divider} />
            <Text style={layout.smallText}>
              This link is personal to you. If you did not request this email, you can safely ignore it.
            </Text>
          </Section>
          <Text style={layout.footer}>
            Sent from Rhythms · <a href={appUrl}>Visit Rhythms</a>
            {supportEmail ? ` · ${supportEmail}` : ""}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

VerifyEmail.PreviewProps = {
  verificationUrl: "https://rhythms.daniel-ives.com/verify?token=demo",
  clientUrl: "https://rhythms.daniel-ives.com",
  supportEmail: "support@rhythms.daniel-ives.com",
} satisfies VerifyEmailProps

export default VerifyEmail
