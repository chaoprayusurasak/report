import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { reportId, status, dispatchDept } = await req.json();

    if (!reportId || (!status && !dispatchDept)) {
      return new Response(JSON.stringify({ error: "Missing reportId or status/dispatchDept" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (dispatchDept) {
      // 1. Fetch report details including coordinates
      const { data: report, error: fetchErr } = await supabase
        .from("reports")
        .select("reference_id, description, location_name, latitude, longitude, category")
        .eq("id", reportId)
        .single();

      if (fetchErr || !report) {
        return new Response(JSON.stringify({ error: "Report not found for dispatch" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 2. Query officers
      const { data: officers, error: officerErr } = await supabase
        .from("department_officers")
        .select("line_user_id, officer_name")
        .eq("department_name", dispatchDept)
        .eq("is_active", true);

      if (officerErr || !officers || officers.length === 0) {
        console.log(`No active officers found for department ${dispatchDept}`);
        return new Response(JSON.stringify({ message: `No active officers found for department ${dispatchDept}` }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // 3. Construct Flex message for officers
      const mapsUrl = (report.latitude && report.longitude)
        ? `https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}`
        : null;

      const flexBubble = {
        "type": "bubble",
        "header": {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#FF4B4B",
          "contents": [
            {
              "type": "text",
              "text": `🔔 มีงานแจ้งซ่อมใหม่ส่งถึง [${dispatchDept}]`,
              "color": "#FFFFFF",
              "weight": "bold",
              "size": "md"
            }
          ]
        },
        "body": {
          "type": "box",
          "layout": "vertical",
          "spacing": "md",
          "contents": [
            {
              "type": "box",
              "layout": "vertical",
              "spacing": "xs",
              "contents": [
                {
                  "type": "text",
                  "text": `หมายเลขอ้างอิง: ${report.reference_id}`,
                  "weight": "bold",
                  "size": "sm"
                },
                {
                  "type": "text",
                  "text": `รายละเอียดปัญหา: ${report.description}`,
                  "size": "sm",
                  "wrap": true,
                  "margin": "xs"
                },
                {
                  "type": "text",
                  "text": `จุดสังเกต: ${report.location_name || "ไม่ระบุ"}`,
                  "size": "sm",
                  "color": "#8C8C8C",
                  "wrap": true
                }
              ]
            }
          ]
        },
        "footer": {
          "type": "box",
          "layout": "vertical",
          "spacing": "sm",
          "contents": [
            ...(mapsUrl ? [{
              "type": "button",
              "style": "primary",
              "color": "#06C755",
              "action": {
                "type": "uri",
                "label": "📍 นำทางบนแผนที่ (Google Maps)",
                "uri": mapsUrl
              }
            }] : []),
            {
              "type": "button",
              "style": "primary",
              "color": "#4A90E2",
              "action": {
                "type": "postback",
                "label": "✅ รับทราบงาน (Acknowledge)",
                "data": `action=acknowledge&reportId=${reportId}`
              }
            }
          ]
        }
      };

      // 4. Send Push Message to all officers of this department
      let sendCount = 0;
      for (const officer of officers) {
        try {
          const res = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              to: officer.line_user_id,
              messages: [{
                type: "flex",
                altText: "มีงานแจ้งซ่อมส่งถึงแผนกของคุณ",
                contents: flexBubble
              }]
            })
          });
          if (res.ok) sendCount++;
          else console.error(`Failed to push to officer ${officer.officer_name}:`, await res.text());
        } catch (err) {
          console.error(`Exception pushing to officer ${officer.officer_name}:`, err);
        }
      }

      return new Response(JSON.stringify({ success: true, message: `Dispatched to ${sendCount} officers` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Query database for report details
    const { data: report, error: fetchErr } = await supabase
      .from("reports")
      .select("reference_id, reporter_name, reporter_line_id, category, description")
      .eq("id", reportId)
      .single();

    if (fetchErr || !report) {
      return new Response(JSON.stringify({ error: "Report not found in database" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { reporter_line_id, reference_id, reporter_name } = report;

    // If report doesn't have a LINE user ID, return success without push
    if (!reporter_line_id) {
      return new Response(JSON.stringify({ message: "Report does not have a linked LINE user ID" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Construct LINE push message
    const messages = [];

    if (status.includes("เสร็จสิ้น")) {
      const flexBubble = {
        "type": "bubble",
        "body": {
          "type": "box",
          "layout": "vertical",
          "spacing": "md",
          "contents": [
            {
              "type": "text",
              "text": "🎉 การแก้ไขเสร็จสิ้นแล้วครับ!",
              "weight": "bold",
              "size": "lg",
              "color": "#06C755"
            },
            {
              "type": "text",
              "text": `เรียน คุณ ${reporter_name || "ผู้ร้องเรียน"},\n\nเรื่องร้องเรียนของท่าน หมายเลขอ้างอิง: ${reference_id || "ไม่มี"}\nได้รับการดำเนินการแก้ไขเรียบร้อยแล้วครับ ✅`,
              "size": "sm",
              "wrap": true
            },
            {
              "type": "separator"
            },
            {
              "type": "text",
              "text": "⭐⭐ กรุณาประเมินความพึงพอใจ ⭐⭐",
              "weight": "bold",
              "size": "sm",
              "color": "#8C8C8C",
              "align": "center",
              "margin": "md"
            },
            {
              "type": "box",
              "layout": "horizontal",
              "spacing": "sm",
              "margin": "md",
              "justifyContent": "center",
              "contents": [
                {
                  "type": "box",
                  "layout": "vertical",
                  "backgroundColor": "#F4B400",
                  "cornerRadius": "md",
                  "width": "40px",
                  "height": "40px",
                  "justifyContent": "center",
                  "action": {
                    "type": "postback",
                    "label": "1 ดาว",
                    "data": `action=rate&id=${reportId}&score=1`,
                    "displayText": "ประเมิน 1 ดาว"
                  },
                  "contents": [
                    {
                      "type": "text",
                      "text": "1",
                      "color": "#FFFFFF",
                      "align": "center",
                      "size": "sm",
                      "weight": "bold"
                    }
                  ]
                },
                {
                  "type": "box",
                  "layout": "vertical",
                  "backgroundColor": "#F4B400",
                  "cornerRadius": "md",
                  "width": "40px",
                  "height": "40px",
                  "justifyContent": "center",
                  "action": {
                    "type": "postback",
                    "label": "2 ดาว",
                    "data": `action=rate&id=${reportId}&score=2`,
                    "displayText": "ประเมิน 2 ดาว"
                  },
                  "contents": [
                    {
                      "type": "text",
                      "text": "2",
                      "color": "#FFFFFF",
                      "align": "center",
                      "size": "sm",
                      "weight": "bold"
                    }
                  ]
                },
                {
                  "type": "box",
                  "layout": "vertical",
                  "backgroundColor": "#F4B400",
                  "cornerRadius": "md",
                  "width": "40px",
                  "height": "40px",
                  "justifyContent": "center",
                  "action": {
                    "type": "postback",
                    "label": "3 ดาว",
                    "data": `action=rate&id=${reportId}&score=3`,
                    "displayText": "ประเมิน 3 ดาว"
                  },
                  "contents": [
                    {
                      "type": "text",
                      "text": "3",
                      "color": "#FFFFFF",
                      "align": "center",
                      "size": "sm",
                      "weight": "bold"
                    }
                  ]
                },
                {
                  "type": "box",
                  "layout": "vertical",
                  "backgroundColor": "#F4B400",
                  "cornerRadius": "md",
                  "width": "40px",
                  "height": "40px",
                  "justifyContent": "center",
                  "action": {
                    "type": "postback",
                    "label": "4 ดาว",
                    "data": `action=rate&id=${reportId}&score=4`,
                    "displayText": "ประเมิน 4 ดาว"
                  },
                  "contents": [
                    {
                      "type": "text",
                      "text": "4",
                      "color": "#FFFFFF",
                      "align": "center",
                      "size": "sm",
                      "weight": "bold"
                    }
                  ]
                },
                {
                  "type": "box",
                  "layout": "vertical",
                  "backgroundColor": "#F4B400",
                  "cornerRadius": "md",
                  "width": "40px",
                  "height": "40px",
                  "justifyContent": "center",
                  "action": {
                    "type": "postback",
                    "label": "5 ดาว",
                    "data": `action=rate&id=${reportId}&score=5`,
                    "displayText": "ประเมิน 5 ดาว"
                  },
                  "contents": [
                    {
                      "type": "text",
                      "text": "5",
                      "color": "#FFFFFF",
                      "align": "center",
                      "size": "sm",
                      "weight": "bold"
                    }
                  ]
                }
              ]
            }
          ]
        }
      };

      messages.push({
        type: "flex",
        altText: "แจ้งผลการดำเนินการและการประเมินความพึงพอใจ",
        contents: flexBubble
      });
    } else {
      messages.push({
        type: "text",
        text: `🔔 แจ้งผลการดำเนินงานครับ!\n\nเรียน คุณ ${reporter_name || "ผู้ร้องเรียน"},\n\nเรื่องร้องเรียนของท่าน หมายเลขอ้างอิง: ${reference_id || "ไม่มี"}\nได้รับการปรับสถานะการแก้ไขเป็น:\n👉 " ${status} "\n\nขอบคุณที่แจ้งข้อมูลให้ทางเทศบาลทราบครับ 😊`
      });
    }

    const lineRes = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: reporter_line_id,
        messages: messages
      })
    });

    if (!lineRes.ok) {
      const errorText = await lineRes.text();
      console.error("LINE push error response:", errorText);
      return new Response(JSON.stringify({ error: "Failed to send LINE push notification", details: errorText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, message: "LINE push message sent successfully" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("Internal Server Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
