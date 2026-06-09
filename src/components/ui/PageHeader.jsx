export default function PageHeader({ icon: Icon, title, subtitle, theme, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2.5">
          {Icon && (
            <Icon
              size={28}
              className={theme === "dark" ? "text-emerald-400" : "text-teal-700"}
            />
          )}
          <h1
            className={`text-3xl font-bold ${
              theme === "dark" ? "text-emerald-400" : "text-teal-700"
            }`}
          >
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
