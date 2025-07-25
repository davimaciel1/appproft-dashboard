import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Progress } from '../components/ui/progress';
import { 
  ArrowLeft, 
  DollarSign, 
  Package, 
  TrendingDown,
  AlertTriangle,
  Calculator,
  Download
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface ProductAnalysis {
  current: {
    asin: string;
    title: string;
    sku: string;
    selling_price: number;
    units_sold: number;
    total_revenue: number;
    product_cost: number;
    total_costs: number;
    gross_profit: number;
    profit_margin: number;
    profit_per_unit: number;
    profit_status: string;
    main_cost_driver: string;
    recommended_action: string;
    recommended_price: number;
    potential_savings_monthly: number;
  };
  history: Array<{
    analysis_date: string;
    profit_margin: number;
    profit_per_unit: number;
    units_sold: number;
    total_revenue: number;
  }>;
  costBreakdown: {
    productCost: number;
    amazonFees: number;
    storageCosts: number;
    returnCosts: number;
  };
  alerts: Array<{
    id: number;
    alert_type: string;
    severity: string;
    title: string;
    message: string;
    created_at: string;
  }>;
}

const ProfitAnalysisDetail = () => {
  const { asin } = useParams<{ asin: string }>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [newProductCost, setNewProductCost] = useState('');
  const [simulatedPrice, setSimulatedPrice] = useState('');
  const [showPriceSimulator, setShowPriceSimulator] = useState(false);

  useEffect(() => {
    if (asin) {
      fetchProductAnalysis();
    }
  }, [asin]);

  const fetchProductAnalysis = async () => {
    try {
      const response = await fetch(`/api/profit-detector/analyses/${asin}`);
      const data = await response.json();
      setAnalysis(data);
      setSimulatedPrice(data.current.selling_price.toString());
    } catch (error) {
      console.error('Error fetching product analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProductCost = async () => {
    if (!newProductCost || parseFloat(newProductCost) < 0) return;

    try {
      await fetch(`/api/profit-detector/products/${asin}/cost`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost: parseFloat(newProductCost) })
      });
      
      // Refresh analysis
      await fetchProductAnalysis();
      setNewProductCost('');
    } catch (error) {
      console.error('Error updating product cost:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const calculateSimulatedProfit = () => {
    if (!analysis || !simulatedPrice) return null;
    
    const price = parseFloat(simulatedPrice);
    const { units_sold, product_cost } = analysis.current;
    const { amazonFees, storageCosts, returnCosts } = analysis.costBreakdown;
    
    // Amazon fees are typically 15% of selling price + fixed FBA fee
    const referralFee = price * 0.15;
    const fbaFee = 3.00; // Simplified - varies by size
    const totalAmazonFees = (referralFee + fbaFee) * units_sold;
    
    const totalRevenue = price * units_sold;
    const totalCosts = (product_cost * units_sold) + totalAmazonFees + storageCosts + returnCosts;
    const grossProfit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const profitPerUnit = units_sold > 0 ? grossProfit / units_sold : 0;
    
    return {
      totalRevenue,
      totalCosts,
      grossProfit,
      profitMargin,
      profitPerUnit
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading analysis...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert>
          <AlertDescription>Product analysis not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { current, history, costBreakdown, alerts } = analysis;

  // Prepare data for charts
  const costBreakdownData = [
    { name: 'Product Cost', value: costBreakdown.productCost, color: '#8884d8' },
    { name: 'Amazon Fees', value: costBreakdown.amazonFees, color: '#82ca9d' },
    { name: 'Storage', value: costBreakdown.storageCosts, color: '#ffc658' },
    { name: 'Returns', value: costBreakdown.returnCosts, color: '#ff7c7c' }
  ];

  const marginHistoryData = history.map(h => ({
    date: new Date(h.analysis_date).toLocaleDateString(),
    margin: h.profit_margin,
    profit: h.profit_per_unit
  }));

  const simulatedProfit = calculateSimulatedProfit();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Button
                variant="ghost"
                onClick={() => navigate('/profit-detector')}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{current.title || current.asin}</h1>
                <p className="text-gray-600">ASIN: {current.asin} | SKU: {current.sku}</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => window.open(`/api/profit-detector/export/csv?asin=${asin}`, '_blank')}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Current Status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Current Profit/Unit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${current.profit_per_unit < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {formatCurrency(current.profit_per_unit)}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Margin: {current.profit_margin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Monthly Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(current.total_revenue)}</div>
              <p className="text-sm text-gray-600 mt-1">
                {current.units_sold} units sold
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Total Costs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(current.total_costs)}</div>
              <p className="text-sm text-gray-600 mt-1">
                Main driver: {current.main_cost_driver.replace('_', ' ')}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recommended Action</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{current.recommended_action}</p>
              {current.recommended_price > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  Target price: {formatCurrency(current.recommended_price)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cost Breakdown Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={costBreakdownData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {costBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profit Margin History</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={marginHistoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="margin" stroke="#8884d8" name="Margin %" />
                  <Line type="monotone" dataKey="profit" stroke="#82ca9d" name="Profit/Unit $" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Actions Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Update Product Cost */}
          <Card>
            <CardHeader>
              <CardTitle>Update Product Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Current cost: {formatCurrency(current.product_cost)}
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="New product cost"
                      value={newProductCost}
                      onChange={(e) => setNewProductCost(e.target.value)}
                    />
                    <Button onClick={updateProductCost}>
                      Update Cost
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Price Simulator */}
          <Card>
            <CardHeader>
              <CardTitle>Price Simulator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Current price: {formatCurrency(current.selling_price)}
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Simulate new price"
                      value={simulatedPrice}
                      onChange={(e) => setSimulatedPrice(e.target.value)}
                    />
                    <Button 
                      variant="outline"
                      onClick={() => setShowPriceSimulator(!showPriceSimulator)}
                    >
                      <Calculator className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {showPriceSimulator && simulatedProfit && (
                  <div className="border rounded p-3 bg-gray-50">
                    <p className="text-sm font-medium mb-2">Simulated Results:</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Revenue:</span>
                        <span>{formatCurrency(simulatedProfit.totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Profit/Unit:</span>
                        <span className={simulatedProfit.profitPerUnit < 0 ? 'text-red-600' : 'text-green-600'}>
                          {formatCurrency(simulatedProfit.profitPerUnit)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Margin:</span>
                        <span className={simulatedProfit.profitMargin < 0 ? 'text-red-600' : 'text-green-600'}>
                          {simulatedProfit.profitMargin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Alerts */}
        {alerts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <Alert key={alert.id} className={
                    alert.severity === 'critical' ? 'border-red-500' :
                    alert.severity === 'high' ? 'border-orange-500' :
                    'border-yellow-500'
                  }>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium">{alert.title}</div>
                      <div className="text-sm mt-1">{alert.message}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(alert.created_at).toLocaleString()}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProfitAnalysisDetail;