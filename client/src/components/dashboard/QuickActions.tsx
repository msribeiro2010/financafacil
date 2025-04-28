import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowDownCircle, ArrowUpCircle, Upload, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

interface QuickActionsProps {
  onAddExpense: () => void;
  onAddIncome: () => void;
}

export function QuickActions({ onAddExpense, onAddIncome }: QuickActionsProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-lg font-medium mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center p-4 h-auto bg-red-50 text-destructive border-red-100 hover:bg-red-100 hover:text-destructive/90 hover:border-red-200"
            onClick={onAddExpense}
          >
            <ArrowDownCircle className="h-6 w-6 mb-2" />
            <span className="text-sm font-medium">Nova Despesa</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center p-4 h-auto bg-green-50 text-accent border-green-100 hover:bg-green-100 hover:text-accent/90 hover:border-green-200"
            onClick={onAddIncome}
          >
            <ArrowUpCircle className="h-6 w-6 mb-2" />
            <span className="text-sm font-medium">Nova Receita</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center p-4 h-auto bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-300"
            onClick={onAddExpense}
          >
            <Upload className="h-6 w-6 mb-2" />
            <span className="text-sm font-medium">Upload Boleto</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex flex-col items-center justify-center p-4 h-auto bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-300"
            asChild
          >
            <Link href="/reports">
              <PieChart className="h-6 w-6 mb-2" />
              <span className="text-sm font-medium">Ver Relatórios</span>
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default QuickActions;
