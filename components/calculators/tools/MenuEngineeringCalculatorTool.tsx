"use client";

import { useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Download, Plus, Trash2 } from "lucide-react";
import { NumberField } from "@/components/calculators/NumberField";
import { formatCurrency, formatNumber } from "@/lib/format";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  cost: number;
  popularity: number;
}

type ClassificationCategory = "star" | "cash-cow" | "puzzle" | "dog";

interface ClassifiedItem extends MenuItem {
  contributionMargin: number;
  contributionMarginPercent: number;
  classification: ClassificationCategory;
}

export function MenuEngineeringCalculatorTool() {
  const [items, setItems] = useState<MenuItem[]>([
    { id: "1", name: "Butter Chicken", price: 350, cost: 100, popularity: 150 },
    { id: "2", name: "Paneer Tikka", price: 280, cost: 80, popularity: 120 },
    { id: "3", name: "Dal Makhani", price: 200, cost: 50, popularity: 200 },
    { id: "4", name: "Biryani", price: 400, cost: 120, popularity: 80 },
  ]);
  const tableRef = useRef<HTMLDivElement>(null);

  const analytics = useMemo(() => {
    if (items.length === 0) {
      return {
        classifiedItems: [],
        averageContributionMargin: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalContribution: 0,
        averagePrice: 0,
        medianPopularity: 0,
        stars: [],
        cashCows: [],
        puzzles: [],
        dogs: [],
      };
    }

    const itemsWithMargin = items.map((item) => ({
      ...item,
      contributionMargin: item.price - item.cost,
      contributionMarginPercent: ((item.price - item.cost) / item.price) * 100,
    }));

    const avgContribution =
      itemsWithMargin.reduce((sum, item) => sum + item.contributionMarginPercent, 0) /
      itemsWithMargin.length;
    const avgPopularity =
      itemsWithMargin.reduce((sum, item) => sum + item.popularity, 0) / itemsWithMargin.length;

    const classifiedItems: ClassifiedItem[] = itemsWithMargin.map((item) => {
      const isHighMargin = item.contributionMarginPercent >= avgContribution;
      const isHighPopularity = item.popularity >= avgPopularity;

      let classification: ClassificationCategory = "dog";
      if (isHighMargin && isHighPopularity) classification = "star";
      else if (isHighMargin && !isHighPopularity) classification = "cash-cow";
      else if (!isHighMargin && isHighPopularity) classification = "puzzle";

      return { ...item, classification };
    });

    const totalRevenue = items.reduce((sum, item) => sum + item.price * item.popularity, 0);
    const totalCost = items.reduce((sum, item) => sum + item.cost * item.popularity, 0);
    const totalContribution = totalRevenue - totalCost;

    return {
      classifiedItems: classifiedItems.sort((a, b) => b.popularity - a.popularity),
      averageContributionMargin: avgContribution,
      totalRevenue,
      totalCost,
      totalContribution,
      averagePrice: items.reduce((sum, item) => sum + item.price, 0) / items.length,
      medianPopularity: avgPopularity,
      stars: classifiedItems.filter((i) => i.classification === "star"),
      cashCows: classifiedItems.filter((i) => i.classification === "cash-cow"),
      puzzles: classifiedItems.filter((i) => i.classification === "puzzle"),
      dogs: classifiedItems.filter((i) => i.classification === "dog"),
    };
  }, [items]);

  const addItem = () => {
    const newItem: MenuItem = {
      id: Date.now().toString(),
      name: "New Item",
      price: 200,
      cost: 80,
      popularity: 50,
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof MenuItem, value: string | number) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const deleteItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const exportToExcel = () => {
    const exportData = analytics.classifiedItems.map((item) => ({
      "Item Name": item.name,
      "Price (₹)": formatCurrency(item.price),
      "Cost (₹)": formatCurrency(item.cost),
      "Contribution Margin (₹)": formatCurrency(item.contributionMargin),
      "Margin %": formatNumber(item.contributionMarginPercent) + "%",
      Popularity: item.popularity,
      Classification: item.classification.toUpperCase(),
    }));

    const summary = [
      {},
      { "Item Name": "SUMMARY" },
      { "Item Name": "Total Revenue", "Price (₹)": formatCurrency(analytics.totalRevenue) },
      { "Item Name": "Total Cost", "Price (₹)": formatCurrency(analytics.totalCost) },
      {
        "Item Name": "Total Contribution",
        "Price (₹)": formatCurrency(analytics.totalContribution),
      },
      { "Item Name": "Average Margin %", "Price (₹)": formatNumber(analytics.averageContributionMargin) + "%" },
      { "Item Name": "Average Price", "Price (₹)": formatCurrency(analytics.averagePrice) },
      {},
      { "Item Name": "CLASSIFICATION BREAKDOWN" },
      { "Item Name": "Stars", "Price (₹)": analytics.stars.length },
      { "Item Name": "Cash Cows", "Price (₹)": analytics.cashCows.length },
      { "Item Name": "Puzzles", "Price (₹)": analytics.puzzles.length },
      { "Item Name": "Dogs", "Price (₹)": analytics.dogs.length },
    ];

    const ws = XLSX.utils.aoa_to_sheet([
      ["Menu Engineering Calculator Report"],
      [""],
      ...XLSX.utils.sheet_add_aoa(XLSX.utils.json_to_sheet(exportData), [], { origin: -1 }).map((row: any) => [
        row["Item Name"],
        row["Price (₹)"],
        row["Cost (₹)"],
        row["Contribution Margin (₹)"],
        row["Margin %"],
        row.Popularity,
        row.Classification,
      ]),
    ]);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Menu Analysis");

    XLSX.writeFile(wb, "menu-engineering-report.xlsx");
  };

  const exportToPDF = async () => {
    if (!tableRef.current) return;

    try {
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 290;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= 297;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      pdf.save("menu-engineering-report.pdf");
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const getClassificationColor = (classification: ClassificationCategory) => {
    switch (classification) {
      case "star":
        return "bg-yellow-50 border-yellow-200";
      case "cash-cow":
        return "bg-green-50 border-green-200";
      case "puzzle":
        return "bg-orange-50 border-orange-200";
      case "dog":
        return "bg-red-50 border-red-200";
    }
  };

  const getClassificationBadge = (classification: ClassificationCategory) => {
    const badges = {
      star: "⭐ Star",
      "cash-cow": "🐄 Cash Cow",
      puzzle: "🧩 Puzzle",
      dog: "🐕 Dog",
    };
    return badges[classification];
  };

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-ink">Menu Items</h3>

        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="grid gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4 sm:grid-cols-6">
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateItem(item.id, "name", e.target.value)}
                placeholder="Item name"
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none sm:col-span-2"
              />
              <input
                type="number"
                value={item.price}
                onChange={(e) => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                placeholder="Price"
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <input
                type="number"
                value={item.cost}
                onChange={(e) => updateItem(item.id, "cost", parseFloat(e.target.value) || 0)}
                placeholder="Cost"
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <input
                type="number"
                value={item.popularity}
                onChange={(e) => updateItem(item.id, "popularity", parseFloat(e.target.value) || 0)}
                placeholder="Units sold"
                className="rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => deleteItem(item.id)}
                className="flex items-center justify-center rounded bg-red-50 text-red-600 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addItem}
          className="mt-4 flex items-center gap-2 rounded bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100"
        >
          <Plus className="h-4 w-4" />
          Add Menu Item
        </button>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium uppercase text-gray-600">Total Revenue</div>
          <div className="mt-2 text-2xl font-bold text-ink">{formatCurrency(analytics.totalRevenue)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium uppercase text-gray-600">Total Cost</div>
          <div className="mt-2 text-2xl font-bold text-ink">{formatCurrency(analytics.totalCost)}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium uppercase text-gray-600">Total Contribution</div>
          <div className="mt-2 text-2xl font-bold text-green-600">
            {formatCurrency(analytics.totalContribution)}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium uppercase text-gray-600">Avg Margin %</div>
          <div className="mt-2 text-2xl font-bold text-ink">
            {formatNumber(analytics.averageContributionMargin)}%
          </div>
        </div>
      </div>

      {/* Classification Breakdown */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4">
          <div className="text-2xl">⭐</div>
          <div className="mt-2 text-sm font-semibold text-yellow-900">Stars</div>
          <div className="mt-1 text-2xl font-bold text-yellow-700">{analytics.stars.length}</div>
          <div className="mt-2 text-xs text-yellow-700">High margin, high popularity</div>
        </div>
        <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
          <div className="text-2xl">🐄</div>
          <div className="mt-2 text-sm font-semibold text-green-900">Cash Cows</div>
          <div className="mt-1 text-2xl font-bold text-green-700">{analytics.cashCows.length}</div>
          <div className="mt-2 text-xs text-green-700">High margin, low popularity</div>
        </div>
        <div className="rounded-lg border-2 border-orange-200 bg-orange-50 p-4">
          <div className="text-2xl">🧩</div>
          <div className="mt-2 text-sm font-semibold text-orange-900">Puzzles</div>
          <div className="mt-1 text-2xl font-bold text-orange-700">{analytics.puzzles.length}</div>
          <div className="mt-2 text-xs text-orange-700">Low margin, high popularity</div>
        </div>
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
          <div className="text-2xl">🐕</div>
          <div className="mt-2 text-sm font-semibold text-red-900">Dogs</div>
          <div className="mt-1 text-2xl font-bold text-red-700">{analytics.dogs.length}</div>
          <div className="mt-2 text-xs text-red-700">Low margin, low popularity</div>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-3">
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 rounded bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </button>
        <button
          onClick={exportToPDF}
          className="flex items-center gap-2 rounded bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
        >
          <Download className="h-4 w-4" />
          Export to PDF
        </button>
      </div>

      {/* Results Table */}
      <div ref={tableRef} className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Item Name</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Price</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Cost</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Margin (₹)</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Margin %</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Units Sold</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Classification</th>
            </tr>
          </thead>
          <tbody>
            {analytics.classifiedItems.map((item, idx) => (
              <tr
                key={item.id}
                className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${getClassificationColor(item.classification)}`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.price)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(item.cost)}</td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {formatCurrency(item.contributionMargin)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {formatNumber(item.contributionMarginPercent)}%
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{item.popularity}</td>
                <td className="px-4 py-3 text-center font-semibold">{getClassificationBadge(item.classification)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Information Section */}
      <div className="rounded-lg border border-gray-200 bg-blue-50 p-6">
        <h3 className="text-lg font-semibold text-ink">Understanding Menu Engineering</h3>
        <div className="mt-4 grid gap-4 text-sm text-gray-700 sm:grid-cols-2">
          <div>
            <div className="font-semibold">⭐ Stars</div>
            <p className="mt-1">High-margin items with strong popularity. Promote these items and maintain their pricing.</p>
          </div>
          <div>
            <div className="font-semibold">🐄 Cash Cows</div>
            <p className="mt-1">High-margin items with low popularity. Consider featuring them more or bundling with popular items.</p>
          </div>
          <div>
            <div className="font-semibold">🧩 Puzzles</div>
            <p className="mt-1">Low-margin items with high popularity. Increase prices gradually or reduce costs to improve margins.</p>
          </div>
          <div>
            <div className="font-semibold">🐕 Dogs</div>
            <p className="mt-1">Low-margin, low-popularity items. Consider removing or significantly improving profitability.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
