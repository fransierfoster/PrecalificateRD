import type { Metadata } from 'next';
import CalculadoraClient from './CalculadoraClient';

export const metadata: Metadata = {
  title: 'Calculadora de ingresos | PrecalificateRD',
  description: 'Escribe el valor de la vivienda y conoce el ingreso mensual aproximado que necesitas según el porcentaje que quieras financiar.',
};

export default function CalculadoraPage() {
  return <CalculadoraClient />;
}
