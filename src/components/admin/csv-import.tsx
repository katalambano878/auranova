"use client";

import { useState } from "react";
import { previewProductCsv } from "@/server/actions/admin-ops";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/fields";

export function CsvImport() {
  const [csv, setCsv] = useState("sku,name,price,category,stock,status,shortDescription\n");
  const [rows, setRows] = useState<{ sku: string; name: string; action: string; detail: string }[]>([]);
  const [note, setNote] = useState("");
  async function run(apply: boolean) {
    const data = new FormData();
    data.set("csv", csv);
    if (apply) data.set("apply", "yes");
    const result = await previewProductCsv(data);
    if (!result.ok) return setNote(result.error);
    setRows(result.rows);
    setNote(result.message || "");
  }
  return (
    <div className="mt-4 space-y-3">
      <Textarea rows={8} value={csv} onChange={(event) => setCsv(event.target.value)} aria-label="Product CSV" />
      <div className="flex gap-3">
        <Button type="button" variant="line" onClick={() => void run(false)}>Dry run</Button>
        <Button type="button" onClick={() => void run(true)}>Apply import</Button>
      </div>
      {note ? <p role="status" className="text-sm">{note}</p> : null}
      {rows.length ? (
        <table className="w-full text-left text-sm">
          <tbody>
            {rows.map((row) => <tr key={`${row.sku}-${row.action}`} className="border-b border-line"><td className="py-2">{row.action}</td><td>{row.sku}</td><td>{row.name}</td><td>{row.detail}</td></tr>)}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
