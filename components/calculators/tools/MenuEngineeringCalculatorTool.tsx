"use client";

import { useMemo, useState, useRef } from "react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Download, Plus, Trash2, ChefHat, X } from "lucide-react";
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
        "Price (₹)": item.price,
        "Cost (₹)": item.cost,
        "Margin (₹)": item.contributionMargin,
        "Margin %": parseFloat(item.contributionMarginPercent.toFixed(2)),
        "Units Sold": item.popularity,
        Classification: item.classification === "star" ? "⭐ Star" :
                       item.classification === "cash-cow" ? "🐄 Cash Cow" :
                       item.classification === "puzzle" ? "🧩 Puzzle" : "🐕 Dog",
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

  const exportToPDF = async () => {
    if (!tableRef.current) return;

    try {
      const element = tableRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgWidth = 280;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageHeight = pdf.internal.pageSize.getHeight();
      let heightLeft = imgHeight;
      let position = 0;

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 15, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 15, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

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
      {/* Input Section - Card Format */}
      <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3">
          <ChefHat className="h-6 w-6 text-blue-600" />
          <h3 className="text-2xl font-bold text-ink">Menu Items</h3>
          <span className="ml-auto inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
            {items.length} items
          </span>
        </div>

        <div className="space-y-5">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs transition-all hover:shadow-md"
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">
                    {idx + 1}
                  </div>
                  <span className="text-sm font-semibold uppercase text-gray-500">Item #{idx + 1}</span>
                </div>
                <button
                  onClick={() => deleteItem(item.id)}
                  className="flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-600 p-2.5 transition-colors duration-200"
                  title="Delete item"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {/* Item Name */}
                <div>
                  <label className="block text-sm font-bold uppercase text-gray-700 mb-3">
                    Item Name
                  </label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(item.id, "name", e.target.value)}
                    placeholder="e.g., Butter Chicken"
                    className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-bold uppercase text-gray-700 mb-3">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    value={item.price}
                    onChange={(e) => updateItem(item.id, "price", parseFloat(e.target.value) || 0)}
                    placeholder="350"
                    className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                  />
                </div>

                {/* Cost */}
                <div>
                  <label className="block text-sm font-bold uppercase text-gray-700 mb-3">
                    Cost (₹)
                  </label>
                  <input
                    type="number"
                    value={item.cost}
                    onChange={(e) => updateItem(item.id, "cost", parseFloat(e.target.value) || 0)}
                    placeholder="100"
                    className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                  />
                </div>

                {/* Popularity */}
                <div>
                  <label className="block text-sm font-bold uppercase text-gray-700 mb-3">
                    Units Sold
                  </label>
                  <input
                    type="number"
                    value={item.popularity}
                    onChange={(e) => updateItem(item.id, "popularity", parseFloat(e.target.value) || 0)}
                    placeholder="150"
                    className="w-full rounded-lg border-2 border-gray-300 px-4 py-3 text-base font-medium text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="mt-6 grid gap-4 sm:grid-cols-3 border-t border-gray-200 pt-4">
                <div className="rounded-lg bg-green-50 p-4">
                  <div className="text-xs font-semibold uppercase text-green-700">Margin</div>
                  <div className="mt-2 text-2xl font-bold text-green-900">
                    ₹{item.price - item.cost}
                  </div>
                  <div className="mt-1 text-xs text-green-600">
                    {formatNumber(((item.price - item.cost) / item.price) * 100)}%
                  </div>
                </div>
                <div className="rounded-lg bg-blue-50 p-4">
                  <div className="text-xs font-semibold uppercase text-blue-700">Total Revenue</div>
                  <div className="mt-2 text-2xl font-bold text-blue-900">
                    ₹{(item.price * item.popularity).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg bg-purple-50 p-4">
                  <div className="text-xs font-semibold uppercase text-purple-700">Total Contribution</div>
                  <div className="mt-2 text-2xl font-bold text-purple-900">
                    ₹{((item.price - item.cost) * item.popularity).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={addItem}
          className="mt-8 flex items-center justify-center gap-2 w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 px-6 py-4 text-base font-semibold text-white transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <Plus className="h-5 w-5" />
          Add New Menu Item
        </button>
      </div>

      {/* Summary Statistics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-xs font-bold uppercase tracking-wide text-blue-700">
            Total Revenue
          </div>
          <div className="mt-3 text-3xl font-bold text-blue-900">
            {formatCurrency(analytics.totalRevenue)}
          </div>
          <div className="mt-1 text-xs text-blue-600">All items combined</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-orange-50 to-orange-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-xs font-bold uppercase tracking-wide text-orange-700">
            Total Cost
          </div>
          <div className="mt-3 text-3xl font-bold text-orange-900">
            {formatCurrency(analytics.totalCost)}
          </div>
          <div className="mt-1 text-xs text-orange-600">COGS total</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50 to-green-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-xs font-bold uppercase tracking-wide text-green-700">
            Total Contribution
          </div>
          <div className="mt-3 text-3xl font-bold text-green-900">
            {formatCurrency(analytics.totalContribution)}
          </div>
          <div className="mt-1 text-xs text-green-600">Profit contribution</div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50 to-purple-100 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-xs font-bold uppercase tracking-wide text-purple-700">
            Avg Margin %
          </div>
          <div className="mt-3 text-3xl font-bold text-purple-900">
            {formatNumber(analytics.averageContributionMargin)}%
          </div>
          <div className="mt-1 text-xs text-purple-600">Across all items</div>
        </div>
      </div>

      {/* Classification Breakdown */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 shadow-sm">
          <div className="text-4xl mb-2">⭐</div>
          <div className="text-sm font-bold text-yellow-900">Stars</div>
          <div className="mt-2 text-3xl font-bold text-yellow-700">{analytics.stars.length}</div>
          <div className="mt-3 text-xs text-yellow-700 leading-relaxed font-medium">
            High margin + High popularity. Promote these items.
          </div>
        </div>

        <div className="rounded-xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-green-100 p-6 shadow-sm">
          <div className="text-4xl mb-2">🐄</div>
          <div className="text-sm font-bold text-green-900">Cash Cows</div>
          <div className="mt-2 text-3xl font-bold text-green-700">{analytics.cashCows.length}</div>
          <div className="mt-3 text-xs text-green-700 leading-relaxed font-medium">
            High margin + Low popularity. Increase visibility.
          </div>
        </div>

        <div className="rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-orange-100 p-6 shadow-sm">
          <div className="text-4xl mb-2">🧩</div>
          <div className="text-sm font-bold text-orange-900">Puzzles</div>
          <div className="mt-2 text-3xl font-bold text-orange-700">{analytics.puzzles.length}</div>
          <div className="mt-3 text-xs text-orange-700 leading-relaxed font-medium">
            Low margin + High popularity. Raise prices or reduce costs.
          </div>
        </div>

        <div className="rounded-xl border-2 border-red-300 bg-gradient-to-br from-red-50 to-red-100 p-6 shadow-sm">
          <div className="text-4xl mb-2">🐕</div>
          <div className="text-sm font-bold text-red-900">Dogs</div>
          <div className="mt-2 text-3xl font-bold text-red-700">{analytics.dogs.length}</div>
          <div className="mt-3 text-xs text-red-700 leading-relaxed font-medium">
            Low margin + Low popularity. Remove or reposition.
          </div>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-3">
        <button
          onClick={exportToExcel}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-6 py-3 font-semibold text-white transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <Download className="h-5 w-5" />
          Export to Excel
        </button>
        <button
          onClick={exportToPDF}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 px-6 py-3 font-semibold text-white transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <Download className="h-5 w-5" />
          Export to PDF
        </button>
      </div>

      {/* Results Table */}
      <div ref={tableRef} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-gray-900">Item Name</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900">Price (₹)</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900">Cost (₹)</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900">Margin (₹)</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900">Margin %</th>
                <th className="px-6 py-4 text-right font-bold text-gray-900">Units Sold</th>
                <th className="px-6 py-4 text-center font-bold text-gray-900">Classification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {analytics.classifiedItems.map((item) => (
                <tr key={item.id} className={`${getClassificationColor(item.classification)} transition-colors hover:opacity-75`}>
                  <td className="px-6 py-4 font-semibold text-gray-900">{item.name}</td>
                  <td className="px-6 py-4 text-right text-gray-700 font-medium">₹{item.price}</td>
                  <td className="px-6 py-4 text-right text-gray-700 font-medium">₹{item.cost}</td>
                  <td className="px-6 py-4 text-right text-gray-900 font-bold">₹{item.contributionMargin}</td>
                  <td className="px-6 py-4 text-right text-gray-900 font-bold">
                    {formatNumber(item.contributionMarginPercent)}%
                  </td>
                  <td className="px-6 py-4 text-right text-gray-700 font-medium">{item.popularity}</td>
                  <td className="px-6 py-4 text-center font-semibold text-gray-900">
                    {getClassificationBadge(item.classification)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Information Section */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-8 shadow-sm">
        <h3 className="text-lg font-bold text-blue-900 mb-4">How to Use This Calculator</h3>
        <div className="grid gap-4 text-sm text-blue-800 sm:grid-cols-2">
          <div className="rounded-lg bg-white/60 p-4 backdrop-blur">
            <div className="font-bold text-blue-900 mb-2">⭐ Stars</div>
            <p>These items have high profit margins AND strong customer demand. Keep them on the menu, promote them, and maintain competitive pricing.</p>
          </div>
          <div className="rounded-lg bg-white/60 p-4 backdrop-blur">
            <div className="font-bold text-blue-900 mb-2">🐄 Cash Cows</div>
            <p>High profit margin but low customer demand. Feature them in combos, pair with popular items, or highlight them on the menu.</p>
          </div>
          <div className="rounded-lg bg-white/60 p-4 backdrop-blur">
            <div className="font-bold text-blue-900 mb-2">🧩 Puzzles</div>
            <p>Customers love these but margins are thin. Consider: increase prices, optimize costs, or reduce portion sizes to improve profitability.</p>
          </div>
          <div className="rounded-lg bg-white/60 p-4 backdrop-blur">
            <div className="font-bold text-blue-900 mb-2">🐕 Dogs</div>
            <p>Low margin AND low popularity. Best action: remove from menu, reposition as loss-leader, or redesign the recipe for better margins.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
