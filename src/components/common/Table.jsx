export default function Table({ headers, rows, renderCell }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="border-b border-[#e7edef] px-3 pb-[11px] text-left text-[9px] font-bold uppercase tracking-[0.09em] text-[#8a9ba0]"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="hover:bg-[#fbfcfc]"
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="whitespace-nowrap border-b border-[#edf1f2] px-3 py-[13px] text-[11px] text-[#587078] last:border-b-0"
                >
                  {renderCell
                    ? renderCell(cell, cellIndex, row)
                    : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}