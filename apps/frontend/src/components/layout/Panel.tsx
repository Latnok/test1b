import type { ReactNode } from "react";

type PanelProps = {
  children: ReactNode;
  description: string;
  title: string;
};

export const Panel = ({ children, description, title }: PanelProps) => {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
};
