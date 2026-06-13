import React from 'react';
import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <div className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-6">
          Monitoreo Ambiental <br className="hidden sm:block" />
          <span className="text-tropical-teal">en Tiempo Real</span>
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-300 mb-10">
          Plataforma avanzada para la visualización de datos climáticos, calidad del aire y predicciones ambientales. Toma decisiones informadas basadas en datos hiperlocales.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            to="/mapa"
            className="px-8 py-4 rounded-lg bg-tropical-teal text-prussian-blue font-bold text-lg hover:bg-opacity-90 transition-all duration-300 shadow-[0_0_20px_rgba(91,192,190,0.4)]"
          >
            Ir al Mapa Interactivo
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Hero;
