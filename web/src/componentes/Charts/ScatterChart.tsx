import { Chart } from "react-google-charts";
import { chartModeList } from "./ChartFunctions";

interface LatencyEntry {
  x1: [number, number];
  x2: [number, number];
}

interface ScatterChartProps {
  data: any[];
  chartMode?: "default" | "minimalist";
}

export const ScatterChart = ({chartMode, data}: ScatterChartProps) => {
  const chartOptions = chartModeList(chartMode, "Scatter Chart");

  return (
    <div
    className="mx-auto text-center pt-3 pb-1 bg-white rounded-lg  border-2 border-blue-700"
    >
      <Chart  
        chartType="ScatterChart"
        data={[
          ['Time', 'Normal', 'Abnormal'],
         // ...data
         [0, 2, 5],
          [1, 3, 6],
          [2, 4, 7],
          [3, 5, 8],
          [4, 6, 9],
          [5, 7, 10],
          [6, 8, 11],
          [7, 9, 12],
          [8, 10, 13],
          [9, 11, 14],
          [10, 12, 15],
          [11, 13, 16],
          [12, 14, 17],
          [13, 15, 18],
          [14, 16, 19],
          [15, 17, 20],
          [16, 18, 21],
          [17, 19, 22],
          [18, 20, 23],
          [19, 21, 24],
          [20, 22, 25],
          [21, 23, 26],
          [22, 24, 27],
          [23, 25, 28],
          [24, 26, 29],
          [25, 27, 30],
          [26, 28, 31],
          [27, 29, 32],
          [28, 30, 33],
          [29, 31, 34],
          [30, 32, 35],
          [31, 33, 36],
          [32, 34, 37],
          [33, 35, 38],
          [34, 36, 39],
          [35, 37, 40],
          [36, 38, 41],
          [37, 39, 42],
          [38, 40, 43],
          [39, 41, 44],
          [40, 42, 45],
          [41, 43, 46],
          [42, 44, 47],
          [43, 45, 48],
          [44, 46, 49],
          [45, 47, 50],
          [46, 48, 51],
          [47, 49, 52],
          [48, 50, 53],
          [49, 51, 54],
          [50, 52, 55]
        ]}
        options={chartOptions}
        rootProps={{ 'data-testid': '1' }}
        legendToggle
      />
    </div>
  );
};