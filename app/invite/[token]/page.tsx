import { redirect } from "next/navigation"

type InvitePageParams = { token: string }

type InvitePageProps = {
  params: Promise<InvitePageParams>
}

export default async function InviteRedirectPage({ params }: InvitePageProps) {
  const resolvedParams = await params
  const inviteToken = resolvedParams.token?.trim() || ""
  redirect(`/sign-in?invite_token=${encodeURIComponent(inviteToken)}`)
}
