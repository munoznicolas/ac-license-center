import React from "react";

interface FormCardProps {
  id?: string;
  title: React.ReactNode;
  columns?: 2 | 3 | 4;
  children: React.ReactNode;
}

/** Shared card shell enforcing consistent title spacing and form-grid gap. */
export const FormCard: React.FC<FormCardProps> = ({
  id,
  title,
  columns,
  children,
}) => {
  const gridClass = columns ? `form-grid cols-${columns}` : "form-grid";
  return (
    <div id={id} className="card form-card">
      <div className="card-title">{title}</div>
      <div className={gridClass}>{children}</div>
    </div>
  );
};
