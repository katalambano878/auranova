import { buySmsPackage } from "@/server/actions/sms";
import { smsWallet } from "@/server/sms";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function packagePrice(amount: string) {
  if (!amount) return "Price on the payment page";
  if (/ghs/i.test(amount)) return amount;
  return `GHS ${amount}`;
}

function messageCount(sms: string) {
  const value = Number(sms);
  if (!sms || !Number.isFinite(value)) return sms || "SMS";
  return value.toLocaleString("en-GH");
}

export default async function SmsWalletPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const query = await searchParams;
  const wallet = await smsWallet();
  const error = typeof query.error === "string" ? query.error : "";
  return (
    <main className="max-w-3xl">
      <h1 className="font-serif text-4xl">SMS</h1>
      <p className="mt-2 text-sm text-stone">The balance and packages come from the Taysend wallet on this server&apos;s API key. Buying opens Taysend&apos;s payment page. The key never goes to the browser.</p>
      {error ? <p className="mt-4 border border-line bg-card px-4 py-3 text-sm" role="alert">{error}</p> : null}
      {!wallet.ok ? (
        <p className="mt-8 border border-line bg-card p-4 text-sm">{wallet.error}</p>
      ) : (
        <>
          <article className="mt-8 border border-line bg-card p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-stone">Balance</p>
            <p className="mt-2 font-serif text-4xl">{wallet.smsLeft.toLocaleString("en-GH")}</p>
            <p className="mt-1 text-sm text-stone">SMS left</p>
          </article>
          <h2 className="mt-10 font-serif text-2xl">Packages</h2>
          {wallet.packages.length === 0 ? <p className="mt-3 text-sm text-stone">Taysend did not return any packages.</p> : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {wallet.packages.map((item) => (
                <li key={item.id} className="flex flex-col border border-line bg-card p-4">
                  <p className="font-serif text-3xl">{messageCount(item.sms)}</p>
                  <p className="mt-1 text-sm text-stone">{item.sms ? "messages" : item.id}</p>
                  <p className="mt-3 text-sm">{packagePrice(item.amount)}</p>
                  <form className="mt-4" action={buySmsPackage}>
                    <input type="hidden" name="packageId" value={item.id} />
                    <Button type="submit">Buy</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
