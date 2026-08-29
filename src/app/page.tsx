import { InvoiceWorkspace } from "@/components/invoice-workspace";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <InvoiceWorkspace
      user={user ? { displayName: user.displayName, email: user.email } : null}
    />
  );
}
