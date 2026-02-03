import { Body, Button, Container, Head, Html, Hr, Preview, Section, Text } from "@react-email/components"
import { colors, layout } from "./emailStyles"

interface ResetPasswordEmailProps {
  resetUrl: string
  clientUrl?: string
  supportEmail?: string
}

const ResetPasswordEmail = ({ resetUrl, clientUrl, supportEmail }: ResetPasswordEmailProps) => {
  const appUrl = clientUrl ?? "https://rhythms.daniel-ives.com"

  return (
    <Html lang="en">
      <Head />
      <Preview>Reset your Rhythms password</Preview>
      <Body style={layout.body}>
        <Container style={layout.container}>
          <Section style={layout.panel}>
            <Text style={layout.pill}>Reset request</Text>
            <Text style={layout.heading}>Reset your password</Text>
            <Text style={layout.text}>
              We received a request to reset your Rhythms password. Use the button below to choose a new
              password. This link expires soon.
            </Text>
            <Button href={resetUrl} style={layout.button}>
              Reset password
            </Button>
            <Text style={{ ...layout.smallText, marginTop: "16px" }}>
              If the button does not work, copy and paste this link into your browser:
            </Text>
            <Text style={{ ...layout.smallText, wordBreak: "break-all", color: colors.accent }}>
              {resetUrl}
            </Text>
            <Hr style={layout.divider} />
            <Text style={layout.smallText}>
              Not you? You can ignore this email and your password will stay the same.
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

ResetPasswordEmail.PreviewProps = {
  resetUrl: "https://rhythms.daniel-ives.com/reset?token=demo",
  clientUrl: "https://rhythms.daniel-ives.com",
  supportEmail: "support@rhythms.daniel-ives.com",
} satisfies ResetPasswordEmailProps

export default ResetPasswordEmail
