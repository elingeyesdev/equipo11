import React from 'react';

const VariableCard = ({ title, value, unit, icon }) => {
  return (
    <div className="bg-space-indigo rounded-xl p-6 border border-dusk-blue hover:border-tropical-teal transition-colors duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-200">{title}</h3>
        <div className="p-2 bg-prussian-blue rounded-lg text-tropical-teal group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-bold text-white">{value}</span>
        <span className="text-xl text-tropical-teal">{unit}</span>
      </div>
    </div>
  );
};

export default VariableCard;
