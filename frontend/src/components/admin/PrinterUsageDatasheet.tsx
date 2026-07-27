"use client";
import { useEffect, useState } from "react";

export default function PrinterUsageDatasheet() {
  const [summary, setSummary] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/admin/management/printers/usage-summary`)
      .then(r => r.json())
      .then(setSummary);
  }, []);

  const ownerTypes = Object.keys(summary);
  const allTech = Array.from(new Set(ownerTypes.flatMap(o => Object.keys(summary[o]))));

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="p-4 border-b border-border bg-muted">
        <h3 className="font-semibold text-lg text-slate-800">Printer Technology Usage</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-muted text-slate-700">
              <th className="p-3 border-b font-medium">Technology</th>
              {ownerTypes.map(o => (
                <th key={o} className="p-3 border-b font-medium capitalize">
                  {o.replace("_", " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allTech.length === 0 ? (
              <tr>
                <td colSpan={ownerTypes.length + 1} className="p-4 text-center text-muted-foreground">
                  No printer profiles found.
                </td>
              </tr>
            ) : (
              allTech.map(tech => (
                <tr key={tech} className="border-b last:border-b-0 hover:bg-muted transition-colors">
                  <td className="p-3 font-medium text-foreground uppercase">
                    {tech.replace("_", " ")}
                  </td>
                  {ownerTypes.map(o => (
                    <td key={o} className="p-3 text-muted-foreground">
                      {summary[o][tech] ?? 0}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
