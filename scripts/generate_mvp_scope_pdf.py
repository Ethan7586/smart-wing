from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "智慧翼企业福利商城_MVP范围简要.pdf"
FONT = "C:/Windows/Fonts/simhei.ttf"

pdfmetrics.registerFont(TTFont("Hei", FONT))
styles = getSampleStyleSheet()
title = ParagraphStyle("title", parent=styles["Title"], fontName="Hei", fontSize=24, leading=34, textColor=colors.HexColor("#143A8F"), alignment=TA_CENTER)
subtitle = ParagraphStyle("subtitle", parent=styles["Normal"], fontName="Hei", fontSize=11, leading=18, textColor=colors.HexColor("#52657D"), alignment=TA_CENTER)
h1 = ParagraphStyle("h1", parent=styles["Heading1"], fontName="Hei", fontSize=16, leading=24, textColor=colors.HexColor("#143A8F"), spaceBefore=12, spaceAfter=8)
h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontName="Hei", fontSize=12, leading=20, textColor=colors.HexColor("#1F5EFF"), spaceBefore=7, spaceAfter=4)
body = ParagraphStyle("body", parent=styles["BodyText"], fontName="Hei", fontSize=9.5, leading=17, textColor=colors.HexColor("#1F2937"), spaceAfter=5)
note = ParagraphStyle("note", parent=body, fontSize=8.5, leading=14, textColor=colors.HexColor("#5B6472"))


def bullet(text: str) -> Paragraph:
    return Paragraph(f"• {text}", body)


def section(story, heading: str, items: list[str]) -> None:
    story.append(Paragraph(heading, h1))
    story.extend(bullet(item) for item in items)


def footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setFont("Hei", 8)
    canvas.setFillColor(colors.HexColor("#8090A6"))
    canvas.drawString(18 * mm, 12 * mm, "雍彻科技（SGSYEN TECH） | 智慧翼企业福利商城 MVP 范围简要")
    canvas.drawRightString(192 * mm, 12 * mm, f"第 {doc.page} 页")
    canvas.restoreState()


def build() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=20 * mm)
    story = [Spacer(1, 24 * mm), Paragraph("智慧翼企业福利商城", title), Paragraph("MVP 范围简要", title), Spacer(1, 10 * mm)]
    story += [Paragraph("技术服务方：雍彻科技（SGSYEN TECH）", subtitle), Paragraph("建设阶段：第一期 MVP", subtitle), Spacer(1, 18 * mm)]
    story.append(Paragraph("项目目标", h1))
    story.append(Paragraph("一期建设可演示、可测试、可验证交易与财务闭环的企业福利商城基础版本。重点不是单纯展示页面，而是员工下单、福利账户扣款、退款回退、账本流水和财务对账能够形成完整闭环。", body))
    story.append(Spacer(1, 10 * mm))
    story.append(Paragraph("交付定位", h2))
    story.append(Paragraph("PC 网页商城与微信小程序为一期主端；Android 原生应用进入第二期建设方向。", body))
    story.append(PageBreak())

    section(story, "一、一期建设内容", [
        "PC 网页商城：首页、分类、搜索、商品详情、购物车、结算、订单中心。",
        "微信小程序：员工移动端首页、分类、商品浏览、购物车、订单与个人中心。",
        "员工登录与基础身份识别；展示福利账户、餐卡账户余额。",
        "严格三级商品分类、商品搜索、测试货盘接入及正式货盘替换能力。",
        "集团 - 企业 - 商城 - 员工基础数据隔离，商品、分类、库存与上下架管理。",
    ])
    section(story, "二、核心交易与财务闭环", [
        "商品加入购物车、库存校验、创建订单与订单状态查询。",
        "福利卡、餐卡组合扣款；账户合计不得超过订单应付金额。",
        "幂等控制：重复请求不得重复创建订单或重复扣款。",
        "取消订单、退款申请、余额回退与售后状态管理。",
        "订单、支付、退款、账户余额、账本流水可逐笔追溯并保持一致。",
        "财务按企业、商城、日期查询和核对订单、支付及账户流水。",
    ])
    section(story, "三、测试环境安排", [
        "甲方预览环境：仅用于展示登录与商城首页，不开放未完成业务功能。",
        "内部 MVP 测试环境：开放完整下单、扣款、退款、账本与对账测试。",
        "正式生产环境：完成正式货盘、业务规则、权限测试与验收后开放。",
    ])
    story.append(PageBreak())
    section(story, "四、第二期建设方向", [
        "Android 原生 App 及推送、离线卡券、生物识别等原生能力。",
        "企业微信、钉钉、企业 SSO 深度登录与员工组织同步。",
        "微信/支付宝真实支付、发票与更完整的财务接口能力。",
        "供应商独立后台、自动货盘接口、履约与库存同步。",
        "ERP、OA、财务系统深度集成，以及正式 OSS/CDN 运营配置。",
    ])
    section(story, "五、一期验收重点", [
        "员工可完成登录、选购、下单、订单查询及退款申请。",
        "福利账户扣款与订单金额一致；退款后余额及账本流水同步回退。",
        "财务人员能够核对企业、商城、日期维度的订单和账户流水。",
        "商品必须符合一级、二级、三级标准分类；分类错误或低置信度商品不公开展示。",
    ])
    story.append(Spacer(1, 6 * mm))
    table = Table([
        [Paragraph("建设阶段", h2), Paragraph("核心成果", h2)],
        [Paragraph("第一期 MVP", body), Paragraph("PC + 微信小程序、交易闭环、福利账户、订单、退款、账本与基础对账", body)],
        [Paragraph("第二期", body), Paragraph("Android、正式支付、供应商接口、企业 SSO、ERP/OA/财务集成与规模化运营", body)],
    ], colWidths=[38 * mm, 130 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EAF1FF")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CAD5E5")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("说明：本文件用于一期范围确认和阶段沟通。正式合同、接口清单、验收标准、服务等级与费用以双方确认的正式文件为准。", note))
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


if __name__ == "__main__":
    build()
