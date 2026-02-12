export type ListItem = {
  id: string;
  content: string;
  created_at: Date;
};

export type ListProps = {
  items: ListItem[];
};

export function List(props: ListProps) {
  return (
    <ul className="flex flex-col gap-1">
      {props.items.map((item) => (
        <li key={item.id} className="flex flex-col p-1 border-l">
          {item.content}
          <span className="text-sm text-neutral-500">
            {item.created_at.toISOString()}
          </span>
        </li>
      ))}
    </ul>
  );
}
