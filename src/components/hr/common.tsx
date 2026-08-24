export function Kpi({title,value,icon,danger}:{title:string;value:any;icon:string;danger?:boolean}){return <div className={`kpi ${danger?'danger-kpi':''}`}><div className="kpi-icon">{icon}</div><div><span>{title}</span><strong>{value}</strong></div><em>اليوم</em></div>}

export function Table({headers,rows}:{headers:string[];rows:any[][]}){return <div className="table-wrap"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{String(v??'—')}</td>)}</tr>)}</tbody></table></div>}

export function Empty({text}:{text:string}){return <div className="empty">{text}</div>}
