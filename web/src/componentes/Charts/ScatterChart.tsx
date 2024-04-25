import { Chart } from "react-google-charts";
import { chartModeList } from "./ChartFunctions";

interface ScatterChartProps {
  data?: [number, number][];
  chartMode?: "default" | "minimalist";
}

export const ScatterChart = ({chartMode}: ScatterChartProps) => {
  const data = [
    ['Age', 'Weight'],
    [8, 12],
    [4, 5.5],
    [11, 14],
    [4, 5],
    [3, 3.5],
    [6.5, 7],
  ];

  const chartOptions = chartModeList(chartMode, "Scatter Chart");

  return (
    <div
    className="mx-auto text-center pt-3 pb-1 bg-white rounded-lg  border-2 border-blue-700"
    >
      <Chart  
        chartType="ScatterChart"
        data={data}
        options={chartOptions}
        rootProps={{ 'data-testid': '1' }}
        legendToggle
      />
    </div>
  );
};