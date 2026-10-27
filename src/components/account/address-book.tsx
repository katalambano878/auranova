"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GHANA_REGIONS } from "@/lib/ghana";
import { deleteAddress, saveAddress } from "@/server/actions/account";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/fields";

type Address = { id: string; label: string; firstName: string; lastName: string; phone: string; region: string; city: string; line1: string; isDefault: boolean };

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 space-y-4">
      {addresses.map((address) => (
        <div key={address.id} className="flex items-start justify-between border border-line p-4">
          <div>
            <p className="font-medium">{address.label}{address.isDefault ? " · Default" : ""}</p>
            <p className="text-sm text-stone">{address.firstName} {address.lastName}, {address.line1}, {address.city}, {address.region}</p>
          </div>
          <button type="button" className="text-sm underline" onClick={async () => { await deleteAddress(address.id); router.refresh(); }}>Remove</button>
        </div>
      ))}
      <Button variant="line" onClick={() => setOpen((value) => !value)}>{open ? "Close" : "Add address"}</Button>
      {open ? (
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const result = await saveAddress({
            label: String(data.get("label") || "Home"),
            firstName: String(data.get("firstName") || ""),
            lastName: String(data.get("lastName") || ""),
            phone: String(data.get("phone") || ""),
            region: String(data.get("region") || ""),
            city: String(data.get("city") || ""),
            line1: String(data.get("line1") || ""),
            isDefault: data.get("isDefault") === "on",
          });
          if (!result.ok) return toast.error(result.error);
          setOpen(false);
          router.refresh();
        }}>
          <Label>Label<Input name="label" defaultValue="Home" /></Label>
          <Label>Phone<Input name="phone" required /></Label>
          <Label>First name<Input name="firstName" required /></Label>
          <Label>Last name<Input name="lastName" required /></Label>
          <Label>Region<select name="region" className="w-full rounded-full border border-line bg-white px-4 py-2">{GHANA_REGIONS.map((region) => <option key={region}>{region}</option>)}</select></Label>
          <Label>City<Input name="city" required /></Label>
          <Label className="sm:col-span-2">Address<Input name="line1" required /></Label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isDefault" /> Default</label>
          <Button type="submit">Save address</Button>
        </form>
      ) : null}
    </div>
  );
}
