import type { Metadata } from 'next';
import CalculadoraClient from './CalculadoraClient';

export const metadata: Metadata = {
  title: 'Calculadora de capacidad de compra | PrecalificateRD',
  description: 'Calcula por precio el ingreso mensual aproximado que necesitas, o por ingreso el precio de vivienda que podrías comprar, según el porcentaje que quieras financiar.',
};

export default function CalculadoraPage() {
  return <CalculadoraClient />;
}
