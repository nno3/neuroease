const KPICard = ({ title, value, icon, description, color, valueColor, iconBg, highlightWhenPositive }) => {
    const num = typeof value === "number" ? value : parseInt(String(value).replace(/\D/g, ""), 10) || 0;
    const isHighlight = highlightWhenPositive && num > 0;
    return (
        <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            flex: '1',
            minWidth: '200px',
            ...(isHighlight && {
                borderLeft: '4px solid #ef4444',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px rgba(239, 68, 68, 0.15)',
            }),
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '12px'
            }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '12px',
                    backgroundColor: iconBg || '#E3F2FD',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0px',
                    color: color || '#4A90E2'
                }}>
                    {icon}
                </div>
                <h3 style={{
                    margin: 0,
                    color: '#64748b',
                    fontSize: '14px',
                    fontWeight: '500',
                    textAlign: 'right'
                }}>
                    {title}
                </h3>
            </div>

            <div style={{
                margin: '16px 0 8px 0',
                fontSize: '25px',
                fontWeight: 'bold',
                color: valueColor || '#111827',
                lineHeight: '1.2'
            }}>
                {value}
            </div>

            {description && (
                <p style={{
                    margin: 0,
                    color: '#94a3b8',
                    fontSize: '12px',
                    lineHeight: '1.4'
                }}>
                    {description}
                </p>
            )}
        </div>
    );
};

export default KPICard;