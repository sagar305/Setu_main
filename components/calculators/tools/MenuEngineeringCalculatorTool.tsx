"use client";

import { useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Download, Plus, Trash2, ChefHat } from "lucide-react";
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
    try {
      const exportData = analytics.classifiedItems.map((item) => ({
        "Item Name": item.name,
        "Price (Rs)": item.price,
        "Cost (Rs)": item.cost,
        "Margin (Rs)": item.contributionMargin,
        "Margin %": parseFloat(item.contributionMarginPercent.toFixed(2)),
        "Units Sold": item.popularity,
        Classification: item.classification === "star" ? "Star" :
                       item.classification === "cash-cow" ? "Cash Cow" :
                       item.classification === "puzzle" ? "Puzzle" : "Dog",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);

      ws["!cols"] = [
        { wch: 20 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 15 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Menu Analysis");

      XLSX.writeFile(wb, "menu-engineering-report.xlsx");
    } catch (error) {
      console.error("Excel export error:", error);
      alert("Failed to export to Excel. Please try again.");
    }
  };

  const exportToPDF = () => {
    try {
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 15;

      // Title
      pdf.setFontSize(16);
      pdf.text("Menu Engineering Analysis Report", 15, yPosition);
      yPosition += 10;

      // Date
      pdf.setFontSize(10);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, 15, yPosition);
      yPosition += 12;

      // Summary Section
      pdf.setFontSize(12);
      pdf.text("Summary Statistics", 15, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      const summaryData = [
        [`Total Revenue:`, formatCurrency(analytics.totalRevenue)],
        [`Total Cost:`, formatCurrency(analytics.totalCost)],
        [`Total Contribution:`, formatCurrency(analytics.totalContribution)],
        [`Average Margin:`, `${formatNumber(analytics.averageContributionMargin)}%`],
      ];

      summaryData.forEach((row) => {
        pdf.text(row[0], 15, yPosition);
        pdf.text(row[1], 120, yPosition);
        yPosition += 6;
      });

      yPosition += 8;

      // Classification Summary
      pdf.setFontSize(12);
      pdf.text("Item Classification", 15, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      const classData = [
        [`Stars:`, analytics.stars.length.toString()],
        [`Cash Cows:`, analytics.cashCows.length.toString()],
        [`Puzzles:`, analytics.puzzles.length.toString()],
        [`Dogs:`, analytics.dogs.length.toString()],
      ];

      classData.forEach((row) => {
        pdf.text(row[0], 15, yPosition);
        pdf.text(row[1], 120, yPosition);
        yPosition += 6;
      });

      yPosition += 10;

      // Table Header
      const tableTop = yPosition;
      const colWidths = [30, 20, 20, 25, 22, 20, 30];
      const headers = ["Item Name", "Price (Rs)", "Cost (Rs)", "Margin (Rs)", "Margin %", "Units", "Classification"];

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");

      let xPos = 15;
      headers.forEach((header, idx) => {
        pdf.text(header, xPos, tableTop);
        xPos += colWidths[idx];
      });

      pdf.setFont("helvetica", "normal");
      yPosition = tableTop + 8;

      // Table Rows
      analytics.classifiedItems.forEach((item) => {
        if (yPosition > pageHeight - 15) {
          pdf.addPage();
          yPosition = 15;
        }

        xPos = 15;
        const classificationText = item.classification === "star" ? "Star" :
                                   item.classification === "cash-cow" ? "Cash Cow" :
                                   item.classification === "puzzle" ? "Puzzle" : "Dog";
        const rowData = [
          item.name,
          `Rs${item.price}`,
          `Rs${item.cost}`,
          `Rs${item.contributionMargin}`,
          `${formatNumber(item.contributionMarginPercent)}%`,
          item.popularity.toString(),
          classificationText,
        ];

        pdf.setFontSize(9);
        rowData.forEach((data, idx) => {
          pdf.text(data, xPos, yPosition);
          xPos += colWidths[idx];
        });

        yPosition += 7;
      });

      pdf.save("menu-engineering-report.pdf");
    } catch (error) {
      console.error("PDF export error:", error);
      alert("Failed to export to PDF. Please try again.");
    }
  };

  const getClassificationColor = (classification: ClassificationCategory) => {
    switch (classification) {
      case "star":
        return "bg-yellow-50 border-l-4 border-yellow-400";
      case "cash-cow":
        return "bg-green-50 border-l-4 border-green-400";
      case "puzzle":
        return "bg-orange-50 border-l-4 border-orange-400";
      case "dog":
        return "bg-red-50 border-l-4 border-red-400";
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
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-blue-600" />
          <h3 className="text-2xl font-bold text-ink">Menu Items</h3>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={item.id} className="rounded-lg border border-gray-300 bg-gray-50 p-4">
              <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-600">Item #{idx + 1}</span>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Row 1 */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Item Name */}
                <div className="flex flex-col">
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Item Name
                  </label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, "name", e.target.value)}
                    placeholder="Item name"
                    className="w-full rounded border border-gray-400 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Price */}
                <div className="flex flex-col">
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full rounded border border-gray-400 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid gap-4 sm:grid-cols-2 pt-6">
                {/* Cost */}
                <div className="flex flex-col">
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Cost (₹)
                  </label>
                  <input
                    type="number"
                    value={item.cost}
                    onChange={(e) => updateItem(item.id, "cost", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full rounded border border-gray-400 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Units Sold */}
                <div className="flex flex-col">
                  <label className="block text-xs font-bold text-gray-700 mb-2">
                    Units Sold
                  </label>
                  <input
                    type="number"
                    value={item.popularity}
                    onChange={(e) => updateItem(item.id, "popularity", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full rounded border border-gray-400 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addItem}
          className="mt-6 flex items-center justify-center gap-2 w-full rounded-lg bg-blue-600 hover:bg-blue-700 px-6 py-3 text-sm font-semibold text-white transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Menu Item
        </button>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-blue-50 p-6">
          <div className="text-xs font-bold uppercase text-blue-700">Total Revenue</div>
          <div className="mt-2 text-2xl font-bold text-blue-900">
            {formatCurrency(analytics.totalRevenue)}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-orange-50 p-6">
          <div className="text-xs font-bold uppercase text-orange-700">Total Cost</div>
          <div className="mt-2 text-2xl font-bold text-orange-900">
            {formatCurrency(analytics.totalCost)}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-green-50 p-6">
          <div className="text-xs font-bold uppercase text-green-700">Total Contribution</div>
          <div className="mt-2 text-2xl font-bold text-green-900">
            {formatCurrency(analytics.totalContribution)}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-purple-50 p-6">
          <div className="text-xs font-bold uppercase text-purple-700">Avg Margin %</div>
          <div className="mt-2 text-2xl font-bold text-purple-900">
            {formatNumber(analytics.averageContributionMargin)}%
          </div>
        </div>
      </div>

      {/* Classification Breakdown */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-6">
          <div className="text-4xl mb-2">⭐</div>
          <div className="text-sm font-bold text-yellow-900">Stars</div>
          <div className="mt-2 text-2xl font-bold text-yellow-700">{analytics.stars.length}</div>
          <div className="mt-2 text-xs text-yellow-700">High margin + High popularity</div>
        </div>

        <div className="rounded-lg border border-green-300 bg-green-50 p-6">
          <div className="text-4xl mb-2">🐄</div>
          <div className="text-sm font-bold text-green-900">Cash Cows</div>
          <div className="mt-2 text-2xl font-bold text-green-700">{analytics.cashCows.length}</div>
          <div className="mt-2 text-xs text-green-700">High margin + Low popularity</div>
        </div>

        <div className="rounded-lg border border-orange-300 bg-orange-50 p-6">
          <div className="text-4xl mb-2">🧩</div>
          <div className="text-sm font-bold text-orange-900">Puzzles</div>
          <div className="mt-2 text-2xl font-bold text-orange-700">{analytics.puzzles.length}</div>
          <div className="mt-2 text-xs text-orange-700">Low margin + High popularity</div>
        </div>

        <div className="rounded-lg border border-red-300 bg-red-50 p-6">
          <div className="text-4xl mb-2">🐕</div>
          <div className="text-sm font-bold text-red-900">Dogs</div>
          <div className="mt-2 text-2xl font-bold text-red-700">{analytics.dogs.length}</div>
          <div className="mt-2 text-xs text-red-700">Low margin + Low popularity</div>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-3">
        <button
          onClick={exportToExcel}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 px-6 py-3 font-semibold text-white transition-colors"
        >
          <Download className="h-4 w-4" />
          Export to Excel
        </button>
        <button
          onClick={exportToPDF}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 px-6 py-3 font-semibold text-white transition-colors"
        >
          <Download className="h-4 w-4" />
          Export to PDF
        </button>
      </div>

      {/* Results Table */}
      <div ref={tableRef} className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-900">Item Name</th>
                <th className="px-4 py-3 text-right font-bold text-gray-900">Price (₹)</th>
                <th className="px-4 py-3 text-right font-bold text-gray-900">Cost (₹)</th>
                <th className="px-4 py-3 text-right font-bold text-gray-900">Margin (₹)</th>
                <th className="px-4 py-3 text-right font-bold text-gray-900">Margin %</th>
                <th className="px-4 py-3 text-right font-bold text-gray-900">Units Sold</th>
                <th className="px-4 py-3 text-center font-bold text-gray-900">Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {analytics.classifiedItems.map((item) => (
                <tr key={item.id} className={`${getClassificationColor(item.classification)}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">₹{item.price}</td>
                  <td className="px-4 py-3 text-right text-gray-700">₹{item.cost}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">₹{item.contributionMargin}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                    {formatNumber(item.contributionMarginPercent)}%
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{item.popularity}</td>
                  <td className="px-4 py-3 text-center font-semibold text-gray-900">
                    {getClassificationBadge(item.classification)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Information Section */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-4">How to Use</h3>
        <div className="grid gap-4 text-sm text-blue-800 sm:grid-cols-2">
          <div>
            <div className="font-bold">⭐ Stars</div>
            <p className="mt-1">High margin + High popularity. Promote these items.</p>
          </div>
          <div>
            <div className="font-bold">🐄 Cash Cows</div>
            <p className="mt-1">High margin + Low popularity. Increase visibility.</p>
          </div>
          <div>
            <div className="font-bold">🧩 Puzzles</div>
            <p className="mt-1">Low margin + High popularity. Raise prices or reduce costs.</p>
          </div>
          <div>
            <div className="font-bold">🐕 Dogs</div>
            <p className="mt-1">Low margin + Low popularity. Remove or reposition.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
