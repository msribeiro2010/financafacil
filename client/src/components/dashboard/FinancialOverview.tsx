import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { PieChart, pieArcLabelClasses } from '@mui/x-charts/PieChart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';

interface FinancialOverviewProps {
  userId: number;
}

export function FinancialOverview({ userId }: FinancialOverviewProps) {
  const { data: expensesByCategory, isLoading: isLoadingExpenses } = useQuery({
    queryKey: [`/api/category-summary/${userId}/expense`],
  });
  
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: [`/api/transactions/${userId}`],
  });
  
  // Prepare data for charts
  const pieChartData = React.useMemo(() => {
    if (!expensesByCategory) return [];
    
    return expensesByCategory.map((category: any) => ({
      id: category.categoryId,
      value: category.total,
      label: category.name,
      color: getCategoryColor(category.categoryId)
    })).slice(0, 5); // Only show top 5 categories
  }, [expensesByCategory]);
  
  const lineChartData = React.useMemo(() => {
    if (!transactions) return [];
    
    // Group transactions by month
    const monthlyData: any = {};
    
    transactions.forEach((transaction: any) => {
      const date = new Date(transaction.date);
      const month = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      if (!monthlyData[month]) {
        monthlyData[month] = {
          month: getMonthName(date.getMonth()),
          income: 0,
          expense: 0
        };
      }
      
      if (transaction.type === 'income') {
        monthlyData[month].income += parseFloat(transaction.amount);
      } else {
        monthlyData[month].expense += parseFloat(transaction.amount);
      }
    });
    
    // Convert to array and sort by date
    return Object.values(monthlyData).slice(-6); // Last 6 months
  }, [transactions]);
  
  // Helper function to get month name
  function getMonthName(monthIndex: number) {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months[monthIndex];
  }
  
  // Helper function to get colors for categories
  function getCategoryColor(categoryId: number) {
    const colors = [
      '#0891B2', // primary
      '#EF4444', // destructive
      '#16A34A', // accent
      '#F59E0B', // amber
      '#3B82F6', // blue
      '#8B5CF6', // purple
      '#EC4899', // pink
    ];
    
    return colors[categoryId % colors.length];
  }
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <Card>
        <CardContent className="p-5">
          <h2 className="text-lg font-medium mb-4">Despesas por Categoria</h2>
          
          {isLoadingExpenses ? (
            <div className="flex items-center justify-center h-64">
              <Skeleton className="h-48 w-48 rounded-full" />
            </div>
          ) : (
            <>
              <div className="h-64 flex items-center justify-center">
                {pieChartData.length > 0 ? (
                  <PieChart
                    series={[
                      {
                        data: pieChartData,
                        innerRadius: 50,
                        outerRadius: 80,
                        paddingAngle: 2,
                        cornerRadius: 4,
                        cx: 120,
                        cy: 100,
                      }
                    ]}
                    width={240}
                    height={200}
                    slotProps={{
                      legend: { hidden: true },
                    }}
                  />
                ) : (
                  <div className="text-center text-slate-500">
                    <p>Sem dados disponíveis</p>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-4">
                {pieChartData.map((item: any) => (
                  <div key={item.id} className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">{item.label} ({Math.round(item.value / pieChartData.reduce((sum: number, cat: any) => sum + cat.value, 0) * 100)}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-5">
          <h2 className="text-lg font-medium mb-4">Fluxo de Caixa</h2>
          
          {isLoadingTransactions ? (
            <div className="h-64 flex items-center justify-center">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <>
              <div className="h-64 flex items-center justify-center">
                {lineChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={lineChartData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis 
                        tickFormatter={(value) => `R$${value.toLocaleString('pt-BR')}`}
                      />
                      <Tooltip 
                        formatter={(value) => [`${formatCurrency(value as number)}`, undefined]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="income"
                        stroke="#0891B2"
                        name="Receitas"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="expense"
                        stroke="#EF4444"
                        name="Despesas"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-slate-500">
                    <p>Sem dados disponíveis</p>
                  </div>
                )}
              </div>
              
              <div className="mt-4 flex space-x-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-primary rounded-full mr-2" />
                  <span className="text-sm">Receitas</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-destructive rounded-full mr-2" />
                  <span className="text-sm">Despesas</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default FinancialOverview;
