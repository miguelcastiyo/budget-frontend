"use client"

import {
  CartesianGrid,
  Cell,
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { SectionCard } from "@/components/budget/insights/section-card"
import { TopTransactionsList } from "@/components/budget/insights/top-transactions-list"
import type {
  Category,
  InsightsDayOfWeekSpendItem,
  InsightsMetricsResponse,
  InsightsTagBreakdownItem,
} from "@/lib/api/types"
import { formatCategory, formatCurrency } from "@/lib/formatters"
import {
  categoryColors,
  chartAnimation,
  dayLabel,
  formatMonthAxisLabel,
  formatMonthTooltipLabel,
  formatShortCurrency,
  formatTooltipCurrency,
  tagColor,
  tooltipContentStyle,
  tooltipItemStyle,
  tooltipLabelStyle,
} from "@/lib/insights"
import {
  ArrowRightLeft,
  BarChart3,
  Flame,
  PieChart as PieChartIcon,
  Repeat,
  TrendingUp,
  Wallet,
} from "lucide-react"

type TrendDatum = {
  label: string
  total: number
}

type CategoryDonutDatum = {
  category: Category
  spendValue: number
  percent_of_total_spend: string
}

type BudgetVsActualDatum = {
  category: string
  budget: number
  actual: number
}

type TagPieDatum = InsightsTagBreakdownItem & {
  spendValue: number
}

type DayOfWeekDatum = InsightsDayOfWeekSpendItem & {
  dayLabel: string
  avg: number
}

type RecurringVariableDatum = {
  name: string
  recurring: number
  variable: number
}

interface InsightsPrimaryMetricsProps {
  data: InsightsMetricsResponse
}

interface InsightsSectionsProps {
  data: InsightsMetricsResponse
  trendData: TrendDatum[]
  categoryDonutData: CategoryDonutDatum[]
  budgetVsActualData: BudgetVsActualDatum[]
  tagPieData: TagPieDatum[]
  dayOfWeekData: DayOfWeekDatum[]
  recurringVariableData: RecurringVariableDatum[]
}

interface InsightsHighlightsProps {
  topTag: InsightsTagBreakdownItem | null
  topDay: InsightsDayOfWeekSpendItem | null
  overBudgetCount: number
}

export function InsightsPrimaryMetrics({ data }: InsightsPrimaryMetricsProps) {
  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      <Card className="p-3 lg:p-4 border-0 shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground text-[11px] lg:text-xs uppercase tracking-wider">
          <Wallet className="h-3.5 w-3.5" />
          Total Spend
        </div>
        <p className="text-lg lg:text-2xl font-bold mt-2">{formatCurrency(data.total_spend)}</p>
      </Card>

      <Card className="p-3 lg:p-4 border-0 shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground text-[11px] lg:text-xs uppercase tracking-wider">
          <ArrowRightLeft className="h-3.5 w-3.5" />
          Transactions
        </div>
        <p className="text-lg lg:text-2xl font-bold mt-2">{data.total_transactions}</p>
      </Card>

      <Card className="p-3 lg:p-4 border-0 shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground text-[11px] lg:text-xs uppercase tracking-wider">
          <Repeat className="h-3.5 w-3.5" />
          Recurring
        </div>
        <p className="text-lg lg:text-2xl font-bold mt-2">{formatCurrency(data.recurring_vs_variable.recurring)}</p>
      </Card>

      <Card className="p-3 lg:p-4 border-0 shadow-sm">
        <div className="flex items-center gap-2 text-muted-foreground text-[11px] lg:text-xs uppercase tracking-wider">
          <TrendingUp className="h-3.5 w-3.5" />
          Avg. Txn
        </div>
        <p className="text-lg lg:text-2xl font-bold mt-2">
          {formatCurrency(parseFloat(data.total_spend) / Math.max(data.total_transactions, 1))}
        </p>
      </Card>
    </div>
  )
}

export function InsightsMobileSections({
  data,
  trendData,
  categoryDonutData,
  budgetVsActualData,
  tagPieData,
  dayOfWeekData,
  recurringVariableData,
}: InsightsSectionsProps) {
  return (
    <Tabs defaultValue="overview" className="lg:hidden">
      <TabsList className="grid w-full grid-cols-3 h-10 rounded-xl">
        <TabsTrigger value="overview" className="text-xs">
          Overview
        </TabsTrigger>
        <TabsTrigger value="breakdown" className="text-xs">
          Breakdown
        </TabsTrigger>
        <TabsTrigger value="behavior" className="text-xs">
          Behavior
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-3 mt-2">
        <SectionCard
          title="Spending Trends"
          subtitle="Monthly spend across selected range"
          compact
          icon={<BarChart3 className="size-4 text-muted-foreground" />}
        >
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ left: 4, right: 4, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => formatMonthAxisLabel(String(value), false)}
                  interval="preserveStartEnd"
                  minTickGap={14}
                />
                <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 11 }} width={48} />
                <Tooltip
                  formatter={(value) => formatTooltipCurrency(value)}
                  labelFormatter={(label) => formatMonthTooltipLabel(String(label))}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 4.5 }}
                  {...chartAnimation}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Needs / Wants / Savings"
          subtitle="Category split by spend"
          compact
          icon={<PieChartIcon className="size-4 text-muted-foreground" />}
        >
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryDonutData}
                  dataKey="spendValue"
                  nameKey="category"
                  innerRadius={44}
                  outerRadius={70}
                  paddingAngle={2}
                  {...chartAnimation}
                >
                  {categoryDonutData.map((entry) => (
                    <Cell key={entry.category} fill={categoryColors[entry.category]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => [
                    `${formatTooltipCurrency(value)} · ${parseFloat(String(item?.payload?.percent_of_total_spend ?? 0)).toFixed(0)}%`,
                    formatCategory(String(item?.payload?.category ?? "")),
                  ]}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 text-[11px]">
            {categoryDonutData.map((item) => (
              <div key={item.category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block size-2 rounded-full" style={{ backgroundColor: categoryColors[item.category] }} />
                  <span>{formatCategory(item.category)}</span>
                </div>
                <span className="text-muted-foreground">{parseFloat(item.percent_of_total_spend).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </TabsContent>

      <TabsContent value="breakdown" className="space-y-3 mt-2">
        <SectionCard title="Budget vs Actual" subtitle="Allocated budget compared with spend" compact>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={budgetVsActualData} layout="vertical" margin={{ left: 4, right: 4, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={formatShortCurrency} tick={{ fontSize: 11 }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={90} />
                <Tooltip
                  formatter={(value) => formatTooltipCurrency(value)}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={{ fill: "var(--color-secondary)", opacity: 0.35 }}
                />
                <Bar dataKey="budget" fill="var(--color-chart-5)" radius={[4, 4, 4, 4]} name="Budget" {...chartAnimation} />
                <Bar dataKey="actual" fill="var(--color-chart-1)" radius={[4, 4, 4, 4]} name="Actual" {...chartAnimation} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Tag Spending" subtitle="All tags in selected range" compact>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tagPieData}
                  dataKey="spendValue"
                  nameKey="tag_name"
                  innerRadius={44}
                  outerRadius={70}
                  paddingAngle={2}
                  {...chartAnimation}
                >
                  {tagPieData.map((entry, index) => (
                    <Cell
                      key={`${entry.tag_id}-${index}`}
                      fill={tagColor(index)}
                      stroke="var(--color-background)"
                      strokeWidth={1.25}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, item) => [
                    `${formatTooltipCurrency(value)} · ${parseFloat(String(item?.payload?.percent_of_total_spend ?? 0)).toFixed(0)}%`,
                    String(item?.payload?.tag_name ?? "Tag"),
                  ]}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {tagPieData.map((tag, index) => (
              <div key={tag.tag_id} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-block size-2 rounded-full" style={{ backgroundColor: tagColor(index) }} />
                  <span className="truncate">{tag.tag_name}</span>
                </div>
                <span className="text-muted-foreground">{parseFloat(tag.percent_of_total_spend).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Top Transactions" subtitle="Largest expenses in selected range" compact>
          <TopTransactionsList items={data.largest_transactions} compact limit={5} />
        </SectionCard>
      </TabsContent>

      <TabsContent value="behavior" className="space-y-3 mt-2">
        <SectionCard title="Recurring vs Variable" subtitle="Committed spend vs flexible spend" compact>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recurringVariableData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip
                  formatter={(value) => formatTooltipCurrency(value)}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="recurring" stackId="a" fill="var(--color-chart-3)" radius={[8, 0, 0, 8]} {...chartAnimation} />
                <Bar dataKey="variable" stackId="a" fill="var(--color-chart-2)" radius={[0, 8, 8, 0]} {...chartAnimation} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg bg-secondary/50 p-2.5">
              <p className="text-muted-foreground">Recurring</p>
              <p className="font-semibold mt-1">{formatCurrency(data.recurring_vs_variable.recurring)}</p>
            </div>
            <div className="rounded-lg bg-secondary/50 p-2.5">
              <p className="text-muted-foreground">Variable</p>
              <p className="font-semibold mt-1">{formatCurrency(data.recurring_vs_variable.variable)}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Spending Patterns" subtitle="Average spend by weekday" compact>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayOfWeekData} margin={{ left: 4, right: 4, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 11 }} width={46} />
                <Tooltip
                  formatter={(value) => formatTooltipCurrency(value)}
                  labelFormatter={(label, payload) => {
                    const day = String(payload?.[0]?.payload?.day ?? label ?? "")
                    return day ? `${day.slice(0, 1).toUpperCase()}${day.slice(1)}` : String(label)
                  }}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  cursor={{ fill: "var(--color-secondary)", opacity: 0.35 }}
                />
                <Bar dataKey="avg" fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} {...chartAnimation} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </TabsContent>
    </Tabs>
  )
}

export function InsightsDesktopSections({
  data,
  trendData,
  categoryDonutData,
  budgetVsActualData,
  tagPieData,
  dayOfWeekData,
  recurringVariableData,
}: InsightsSectionsProps) {
  return (
    <div className="hidden lg:grid gap-4 lg:grid-cols-12">
      <SectionCard
        title="Spending Trends"
        subtitle="Monthly spend across selected range"
        className="lg:col-span-8"
        icon={<BarChart3 className="size-4 text-muted-foreground" />}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tickFormatter={(value) => formatMonthAxisLabel(String(value), true)}
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 12 }} width={56} />
              <Tooltip
                formatter={(value) => formatTooltipCurrency(value)}
                labelFormatter={(label) => formatMonthTooltipLabel(String(label))}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="total"
                stroke="var(--color-chart-1)"
                strokeWidth={2.5}
                dot={{ r: 2.5 }}
                activeDot={{ r: 5 }}
                {...chartAnimation}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title="Needs / Wants / Savings"
        subtitle="Category split by spend"
        className="lg:col-span-4"
        icon={<PieChartIcon className="size-4 text-muted-foreground" />}
      >
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryDonutData}
                dataKey="spendValue"
                nameKey="category"
                innerRadius={64}
                outerRadius={90}
                paddingAngle={3}
                {...chartAnimation}
              >
                {categoryDonutData.map((entry) => (
                  <Cell key={entry.category} fill={categoryColors[entry.category]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, item) => [
                  `${formatTooltipCurrency(value)} · ${parseFloat(String(item?.payload?.percent_of_total_spend ?? 0)).toFixed(0)}%`,
                  formatCategory(String(item?.payload?.category ?? "")),
                ]}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1 text-xs">
          {categoryDonutData.map((item) => (
            <div key={item.category} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: categoryColors[item.category] }} />
                <span>{formatCategory(item.category)}</span>
              </div>
              <span className="text-muted-foreground">{parseFloat(item.percent_of_total_spend).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Budget vs Actual" subtitle="Allocated budget compared with spend" className="lg:col-span-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={budgetVsActualData} layout="vertical" margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={formatShortCurrency} tick={{ fontSize: 12 }} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 12 }} width={110} />
              <Tooltip
                formatter={(value) => formatTooltipCurrency(value)}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                cursor={{ fill: "var(--color-secondary)", opacity: 0.35 }}
              />
              <Bar dataKey="budget" fill="var(--color-chart-5)" radius={[4, 4, 4, 4]} name="Budget" {...chartAnimation} />
              <Bar dataKey="actual" fill="var(--color-chart-1)" radius={[4, 4, 4, 4]} name="Actual" {...chartAnimation} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="Recurring vs Variable Spending" subtitle="Committed spend vs flexible spend" className="lg:col-span-6">
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={recurringVariableData} layout="vertical" margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" hide />
              <Tooltip
                formatter={(value) => formatTooltipCurrency(value)}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
              <Bar dataKey="recurring" stackId="a" fill="var(--color-chart-3)" radius={[8, 0, 0, 8]} {...chartAnimation} />
              <Bar dataKey="variable" stackId="a" fill="var(--color-chart-2)" radius={[0, 8, 8, 0]} {...chartAnimation} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div className="rounded-xl bg-secondary/50 p-3">
            <p className="text-muted-foreground text-xs">Recurring</p>
            <p className="font-semibold mt-1">{formatCurrency(data.recurring_vs_variable.recurring)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {parseFloat(data.recurring_vs_variable.recurring_percent).toFixed(0)}%
            </p>
          </div>
          <div className="rounded-xl bg-secondary/50 p-3">
            <p className="text-muted-foreground text-xs">Variable</p>
            <p className="font-semibold mt-1">{formatCurrency(data.recurring_vs_variable.variable)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {parseFloat(data.recurring_vs_variable.variable_percent).toFixed(0)}%
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Tag Spending Breakdown" subtitle="All tags in selected range" className="lg:col-span-6">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={tagPieData}
                dataKey="spendValue"
                nameKey="tag_name"
                innerRadius={56}
                outerRadius={90}
                paddingAngle={2}
                {...chartAnimation}
              >
                {tagPieData.map((entry, index) => (
                  <Cell
                    key={`${entry.tag_id}-${index}`}
                    fill={tagColor(index)}
                    stroke="var(--color-background)"
                    strokeWidth={1.25}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, item) => [
                  `${formatTooltipCurrency(value)} · ${parseFloat(String(item?.payload?.percent_of_total_spend ?? 0)).toFixed(0)}%`,
                  String(item?.payload?.tag_name ?? "Tag"),
                ]}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
          {tagPieData.map((tag, index) => (
            <div key={tag.tag_id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: tagColor(index) }} />
                <span className="truncate">{tag.tag_name}</span>
              </div>
              <span className="text-muted-foreground">{parseFloat(tag.percent_of_total_spend).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Spending Behavior Patterns" subtitle="Average spend by weekday" className="lg:col-span-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayOfWeekData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dayLabel" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 12 }} width={54} />
              <Tooltip
                formatter={(value) => formatTooltipCurrency(value)}
                labelFormatter={(label, payload) => {
                  const day = String(payload?.[0]?.payload?.day ?? label ?? "")
                  return day ? `${day.slice(0, 1).toUpperCase()}${day.slice(1)}` : String(label)
                }}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
                cursor={{ fill: "var(--color-secondary)", opacity: 0.35 }}
              />
              <Bar dataKey="avg" fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} {...chartAnimation} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard
        title="Top Transactions"
        subtitle="Highest transactions in the selected range"
        className="lg:col-span-12"
        icon={<Flame className="size-4 text-muted-foreground" />}
      >
        <TopTransactionsList items={data.largest_transactions} />
      </SectionCard>
    </div>
  )
}

export function InsightsHighlights({ topTag, topDay, overBudgetCount }: InsightsHighlightsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <Card className="p-3 border-0 shadow-sm">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Top Tag</p>
          <p className="text-sm font-semibold mt-2 truncate">{topTag ? topTag.tag_name : "-"}</p>
          <p className="text-xs text-muted-foreground mt-1">{topTag ? formatCurrency(topTag.spend) : "$0.00"}</p>
        </Card>
        <Card className="p-3 border-0 shadow-sm">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Over Budget</p>
          <p className="text-sm font-semibold mt-2">{overBudgetCount}</p>
          <p className="text-xs text-muted-foreground mt-1">categories</p>
        </Card>
      </div>

      <div className="hidden lg:grid gap-4 lg:grid-cols-3">
        <Card className="p-4 border-0 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Top Tag</p>
          <p className="text-lg font-semibold mt-2">{topTag ? topTag.tag_name : "-"}</p>
          <p className="text-sm text-muted-foreground mt-1">{topTag ? formatCurrency(topTag.spend) : "$0.00"}</p>
        </Card>

        <Card className="p-4 border-0 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Highest Spend Day</p>
          <p className="text-lg font-semibold mt-2">{topDay ? dayLabel(topDay.day) : "-"}</p>
          <p className="text-sm text-muted-foreground mt-1">{topDay ? formatCurrency(topDay.total_spend) : "$0.00"}</p>
        </Card>

        <Card className="p-4 border-0 shadow-sm">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Budget Pressure</p>
          <p className="text-lg font-semibold mt-2">{overBudgetCount}</p>
          <p className="text-sm text-muted-foreground mt-1">categories over budget in selected range</p>
        </Card>
      </div>
    </>
  )
}
