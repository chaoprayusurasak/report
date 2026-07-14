import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const LINE_CHANNEL_ACCESS_TOKEN = Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN") || "";
const LINE_CHANNEL_SECRET = Deno.env.get("LINE_CHANNEL_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper function to verify signature
async function verifySignature(bodyText: string, signature: string): Promise<boolean> {
  console.log("verifySignature raw input:", {
    secretLength: LINE_CHANNEL_SECRET ? LINE_CHANNEL_SECRET.length : 0,
    secretStart: LINE_CHANNEL_SECRET ? LINE_CHANNEL_SECRET.slice(0, 3) : "none",
    bodyText,
    signature
  });

  if (!LINE_CHANNEL_SECRET) {
    console.log("No secret configured, skipping verification");
    return true;
  }
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(bodyText)
  );
  const uint8 = new Uint8Array(signed);
  let binary = "";
  for (let i = 0; i < uint8.byteLength; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  const expectedSignature = btoa(binary);
  console.log("verifySignature result:", {
    expectedSignature,
    matches: expectedSignature === signature
  });
  return expectedSignature === signature;
}

// Helper to reply to LINE messages
async function replyMessage(replyToken: string, messages: any[]) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });
  if (!res.ok) {
    console.error("Failed to reply message:", await res.text());
  }
}

// Fetch LINE user profile
async function getUserProfile(userId: string): Promise<{ displayName: string } | null> {
  try {
    const res = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
      headers: {
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
      },
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error("Failed to get profile:", err);
  }
  return null;
}

// Detect problem category from description keywords
function detectCategory(description: string): string {
  const desc = description.toLowerCase();
  if (desc.includes("ไฟ") || desc.includes("แสงสว่าง")) return "electricity";
  if (desc.includes("ถนน") || desc.includes("ทางเท้า") || desc.includes("ชำรุด") || desc.includes("หลุม")) return "road";
  if (desc.includes("น้ำ") || desc.includes("ท่อ") || desc.includes("ระบาย")) return "water";
  if (desc.includes("ขยะ") || desc.includes("สะอาด") || desc.includes("เหม็น")) return "garbage";
  if (desc.includes("สวน") || desc.includes("ต้นไม้")) return "park";
  if (desc.includes("ป้าย") || desc.includes("จราจร") || desc.includes("ไฟแดง")) return "traffic";
  if (desc.includes("เสียง") || desc.includes("มลพิษ") || desc.includes("กลิ่น")) return "noise";
  if (desc.includes("หมา") || desc.includes("แมว") || desc.includes("สัตว์")) return "stray";
  return "other";
}

// Generate Reference ID
function generateRefId(): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RPT-${yy}${mm}${dd}-${rand}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const signature = req.headers.get("x-line-signature") || "";
  const bodyText = await req.text();

  if (!await verifySignature(bodyText, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const data = JSON.parse(bodyText);
  const events = data.events || [];

  for (const event of events) {
    const lineUserId = event.source.userId;
    const replyToken = event.replyToken;

    if (!lineUserId || !replyToken) continue;

    // Fetch user state
    const { data: session } = await supabase
      .from("user_sessions")
      .select("*")
      .eq("line_user_id", lineUserId)
      .single();

    const currentStep = session ? session.current_step : "ask_location";
    const tempData = session ? session.temp_data || {} : {};

    // 0. Process Postback Events (for ratings)
    if (event.type === "postback") {
      const postbackData = event.postback.data || "";
      if (postbackData.startsWith("action=rate")) {
        const params = new URLSearchParams(postbackData);
        const reportId = params.get("id");
        const score = parseInt(params.get("score") || "0", 10);

        if (reportId && score >= 1 && score <= 5) {
          // Update rating in the database
          const { error: updateErr } = await supabase
            .from("reports")
            .update({ rating: score })
            .eq("id", reportId);

          if (updateErr) {
            console.error("Failed to save rating:", updateErr);
            await replyMessage(replyToken, [{
              type: "text",
              text: "เกิดข้อผิดพลาดในการบันทึกคะแนนความพึงพอใจครับ"
            }]);
          } else {
            const stars = "⭐".repeat(score);
            await replyMessage(replyToken, [{
              type: "text",
              text: `ขอบคุณสำหรับคะแนนประเมิน ${score} ดาว (${stars}) ครับ! ทางเทศบาลจะนำคำติชมไปปรับปรุงการบริการให้ดียิ่งขึ้นครับ ❤️`
            }]);
          }
        }
      }
      continue;
    }

    // 1. Process Event
    if (event.type === "message") {
      const message = event.message;

      // Handle Cancel command
      if (message.type === "text" && (message.text === "ยกเลิก" || message.text === "cancel")) {
        await supabase.from("user_sessions").delete().eq("line_user_id", lineUserId);
        await replyMessage(replyToken, [{ type: "text", text: "ยกเลิกการแจ้งเรื่องเรียบร้อยแล้วครับ ขอบคุณครับ" }]);
        continue;
      }

      // Step Machine
      if (currentStep === "ask_location") {
        if (message.type === "location") {
          // Save location and move to ask_detail
          const nextTempData = {
            ...tempData,
            latitude: message.latitude,
            longitude: message.longitude,
            address: message.address || message.title || "ไม่ได้ระบุที่อยู่แน่ชัด",
          };

          await supabase.from("user_sessions").upsert({
            line_user_id: lineUserId,
            current_step: "confirm_org",
            temp_data: nextTempData,
            updated_at: new Date().toISOString()
          });

          await replyMessage(replyToken, [
            {
              type: "text",
              text: `📍 ได้รับตำแหน่งแล้วครับที่: ${nextTempData.address}`
            },
            {
              type: "text",
              text: "ต้องการแจ้งเรื่องเข้าหน่วยงาน เทศบาลนครเจ้าพระยาสุรศักดิ์",
              quickReply: {
                items: [
                  {
                    type: "action",
                    action: {
                      type: "message",
                      label: "ยืนยัน",
                      text: "ยืนยัน"
                    }
                  },
                  {
                    type: "action",
                    action: {
                      type: "message",
                      label: "เลือกหน่วยงานอื่น",
                      text: "เลือกหน่วยงานอื่น"
                    }
                  },
                  {
                    type: "action",
                    action: {
                      type: "message",
                      label: "ยกเลิกการแจ้ง",
                      text: "ยกเลิก"
                    }
                  }
                ]
              }
            }
          ]);
        } else {
          // Ask for location again
          await replyMessage(replyToken, [
            {
              type: "text",
              text: "กรุณาส่งพิกัดสถานที่โดยกดแชร์พิกัดบนแผนที่ครับ 😊"
            },
            {
              type: "template",
              altText: "กรุณากดแชร์ตำแหน่งที่เกิดเหตุ",
              template: {
                type: "buttons",
                text: "กรุณากดปุ่มด้านล่างเพื่อแชร์ตำแหน่งที่เกิดเหตุบนแผนที่",
                actions: [
                  {
                    "type": "uri",
                    "label": "📍 แชร์ตำแหน่ง",
                    "uri": "line://nv/location"
                  }
                ]
              }
            }
          ]);
        }
      }
      else if (currentStep === "confirm_org") {
        if (message.type === "text") {
          const command = message.text.trim();
          if (command === "ยืนยัน") {
            await supabase.from("user_sessions").upsert({
              line_user_id: lineUserId,
              current_step: "ask_detail",
              temp_data: tempData,
              updated_at: new Date().toISOString()
            });

            await replyMessage(replyToken, [{
              type: "text",
              text: "📝 ยืนยันหน่วยงานเรียบร้อยครับ\n\nกรุณาพิมพ์อธิบายรายละเอียดของปัญหาที่พบด้วยครับ (เช่น ฝาท่อชำรุด, หลอดไฟส่องทางดับ)"
            }]);
          } else if (command === "เลือกหน่วยงานอื่น") {
            await replyMessage(replyToken, [{
              type: "text",
              text: "ขณะนี้ระบบรองรับเฉพาะการแจ้งเรื่องเข้า เทศบาลนครเจ้าพระยาสุรศักดิ์ เท่านั้นครับ 😊\n\nกรุณากดยืนยันเพื่อดำเนินการต่อ หรือกดยกเลิกเพื่อจบบทสนทนาครับ",
              quickReply: {
                items: [
                  {
                    type: "action",
                    action: {
                      type: "message",
                      label: "ยืนยัน",
                      text: "ยืนยัน"
                    }
                  },
                  {
                    type: "action",
                    action: {
                      type: "message",
                      label: "ยกเลิกการแจ้ง",
                      text: "ยกเลิก"
                    }
                  }
                ]
              }
            }]);
          } else if (command === "ยกเลิก") {
            await supabase.from("user_sessions").delete().eq("line_user_id", lineUserId);
            await replyMessage(replyToken, [{ type: "text", text: "ยกเลิกการแจ้งเรื่องเรียบร้อยแล้วครับ ขอบคุณครับ" }]);
          } else {
            await replyMessage(replyToken, [{
              type: "text",
              text: "กรุณากดปุ่มด้านล่างเพื่อดำเนินการต่อครับ",
              quickReply: {
                items: [
                  {
                    type: "action",
                    action: {
                      type: "message",
                      label: "ยืนยัน",
                      text: "ยืนยัน"
                    }
                  },
                  {
                    type: "action",
                    action: {
                      type: "message",
                      label: "เลือกหน่วยงานอื่น",
                      text: "เลือกหน่วยงานอื่น"
                    }
                  },
                  {
                    type: "action",
                    action: {
                      type: "message",
                      label: "ยกเลิกการแจ้ง",
                      text: "ยกเลิก"
                    }
                  }
                ]
              }
            }]);
          }
        } else {
          await replyMessage(replyToken, [{
            type: "text",
            text: "กรุณากดปุ่มหรือพิมพ์เพื่อเลือกขั้นตอนถัดไปครับ",
            quickReply: {
              items: [
                {
                  type: "action",
                  action: {
                    type: "message",
                    label: "ยืนยัน",
                    text: "ยืนยัน"
                  }
                },
                {
                  type: "action",
                  action: {
                    type: "message",
                    label: "เลือกหน่วยงานอื่น",
                    text: "เลือกหน่วยงานอื่น"
                  }
                },
                {
                  type: "action",
                  action: {
                    type: "message",
                    label: "ยกเลิกการแจ้ง",
                    text: "ยกเลิก"
                  }
                }
              ]
            }
          }]);
        }
      } 
      else if (currentStep === "ask_detail") {
        if (message.type === "text") {
          const nextTempData = {
            ...tempData,
            description: message.text.trim()
          };

          await supabase.from("user_sessions").upsert({
            line_user_id: lineUserId,
            current_step: "ask_image",
            temp_data: nextTempData,
            updated_at: new Date().toISOString()
          });

          await replyMessage(replyToken, [{
            type: "text",
            text: "📝 บันทึกรายละเอียดแล้วครับ\n\nขั้นตอนสุดท้าย: กรุณาส่งรูปภาพประกอบของปัญหาที่พบมา 1 รูปครับ (หรือพิมพ์ 'ไม่มี' หากไม่มีรูปประกอบ)"
          }]);
        } else {
          await replyMessage(replyToken, [{
            type: "text",
            text: "กรุณาพิมพ์อธิบายรายละเอียดของปัญหาเป็นข้อความตัวอักษรครับ"
          }]);
        }
      } 
      else if (currentStep === "ask_image") {
        let imageUrls: string[] = [];

        if (message.type === "image") {
          // Send thinking response or directly fetch image content
          const imageId = message.id;
          const imageRes = await fetch(`https://api-data.line.me/v2/bot/message/${imageId}/content`, {
            headers: {
              Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
            }
          });

          if (imageRes.ok) {
            const blob = await imageRes.blob();
            const fileName = `${lineUserId}-${Date.now()}.jpg`;

            // Upload image to Supabase Storage
            const { data: uploadData, error: uploadErr } = await supabase.storage
              .from("report-images")
              .upload(fileName, blob, {
                contentType: "image/jpeg",
                upsert: true
              });

            if (uploadErr) {
              console.error("Storage upload error:", uploadErr);
            } else {
              // Get public URL
              const { data: publicUrlData } = supabase.storage
                .from("report-images")
                .getPublicUrl(fileName);

              if (publicUrlData?.publicUrl) {
                imageUrls.push(publicUrlData.publicUrl);
              }
            }
          } else {
            console.error("Failed to download image from LINE API:", await imageRes.text());
          }
        } else if (message.type === "text" && (message.text.trim() === "ไม่มี" || message.text.trim() === "no")) {
          // User has no image
        } else {
          await replyMessage(replyToken, [{
            type: "text",
            text: "กรุณาส่งรูปภาพประกอบ (หรือพิมพ์ 'ไม่มี' เพื่อส่งเรื่องทันที) ครับ"
          }]);
          continue;
        }

        // Gather profile details
        const profile = await getUserProfile(lineUserId);
        const reporterName = profile ? profile.displayName : "ผู้ใช้งาน LINE";
        const refId = generateRefId();
        const category = detectCategory(tempData.description || "");

        // Save report into database
        const { error: insertErr } = await supabase.from("reports").insert({
          reporter_name: reporterName,
          reporter_phone: "แจ้งผ่าน LINE",
          reporter_line_id: lineUserId,
          category: category,
          description: tempData.description,
          latitude: tempData.latitude,
          longitude: tempData.longitude,
          location_name: tempData.address,
          image_urls: imageUrls,
          status: "รอดำเนินการ",
          reference_id: refId
        });

        if (insertErr) {
          console.error("Database insert error:", insertErr);
          await replyMessage(replyToken, [{
            type: "text",
            text: "เกิดข้อผิดพลาดในการบันทึกข้อมูลเข้าระบบ กรุณาลองใหม่อีกครั้งภายหลังครับ"
          }]);
        } else {
          // Clear session state
          await supabase.from("user_sessions").delete().eq("line_user_id", lineUserId);

          // Construct and reply with LINE Flex Message summary card
          const formattedDate = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
          const formattedTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
          
          const flexBubble = {
            "type": "bubble",
            ...(imageUrls.length > 0 ? {
              "hero": {
                "type": "image",
                "url": imageUrls[0],
                "size": "full",
                "aspectRatio": "20:13",
                "aspectMode": "cover"
              }
            } : {}),
            "body": {
              "type": "box",
              "layout": "vertical",
              "spacing": "md",
              "contents": [
                {
                  "type": "box",
                  "layout": "vertical",
                  "contents": [
                    {
                      "type": "box",
                      "layout": "horizontal",
                      "height": "6px",
                      "backgroundColor": "#EBEBEB",
                      "cornerRadius": "3px",
                      "contents": [
                        {
                          "type": "box",
                          "layout": "vertical",
                          "width": "33%",
                          "backgroundColor": "#FF4B4B",
                          "height": "6px",
                          "contents": []
                        }
                      ]
                    },
                    {
                      "type": "box",
                      "layout": "horizontal",
                      "spacing": "xs",
                      "margin": "sm",
                      "contents": [
                        {
                          "type": "text",
                          "text": "รอรับเรื่อง",
                          "size": "xs",
                          "color": "#FF4B4B",
                          "weight": "bold",
                          "align": "start"
                        },
                        {
                          "type": "text",
                          "text": "กำลังดำเนินการ",
                          "size": "xs",
                          "color": "#8C8C8C",
                          "align": "center"
                        },
                        {
                          "type": "text",
                          "text": "เสร็จสิ้น",
                          "size": "xs",
                          "color": "#8C8C8C",
                          "align": "end"
                        }
                      ]
                    }
                  ]
                },
                {
                  "type": "separator",
                  "margin": "md"
                },
                {
                  "type": "box",
                  "layout": "vertical",
                  "margin": "md",
                  "spacing": "xs",
                  "paddingStart": "20px",
                  "contents": [
                    {
                      "type": "box",
                      "layout": "horizontal",
                      "spacing": "sm",
                      "contents": [
                        {
                          "type": "text",
                          "text": "⭕",
                          "size": "sm",
                          "color": "#FF4B4B",
                          "flex": 0
                        },
                        {
                          "type": "text",
                          "text": `${formattedDate} ${formattedTime} น.`,
                          "size": "sm",
                          "color": "#8C8C8C"
                        }
                      ]
                    },
                    {
                      "type": "text",
                      "text": "รอรับเรื่อง",
                      "size": "sm",
                      "color": "#FF4B4B",
                      "weight": "bold",
                      "margin": "xs"
                    },
                    {
                      "type": "text",
                      "text": tempData.description || "ไม่ได้ระบุรายละเอียด",
                      "size": "md",
                      "weight": "bold",
                      "wrap": true
                    },
                    {
                      "type": "text",
                      "text": `📍 ${tempData.address || "ไม่ระบุตำแหน่ง"}`,
                      "size": "xs",
                      "color": "#8C8C8C",
                      "wrap": true
                    },
                    {
                      "type": "text",
                      "text": `หมายเลขอ้างอิง: ${refId}`,
                      "size": "xs",
                      "color": "#8C8C8C",
                      "margin": "xs"
                    }
                  ]
                }
              ]
            },
            "footer": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "button",
                  "style": "primary",
                  "color": "#06C755",
                  "action": {
                    "type": "message",
                    "label": "แจ้งเรื่องใหม่",
                    "text": "เริ่ม"
                  }
                }
              ]
            }
          };

          await replyMessage(replyToken, [
            {
              "type": "text",
              "text": "🎉 รับเรื่องแจ้งเรียบร้อยแล้วครับ!"
            },
            {
              "type": "flex",
              "altText": "สรุปการแจ้งเรื่องร้องเรียน",
              "contents": flexBubble
            }
          ]);
        }
      }
    } 
    else if (event.type === "follow") {
      // User added LINE OA
      await supabase.from("user_sessions").delete().eq("line_user_id", lineUserId);
      await replyMessage(replyToken, [
        {
          type: "text",
          text: "ยินดีต้อนรับสู่ระบบแจ้งเรื่องร้องเรียนผ่านแชทอัตโนมัติครับ! 🤖✨\n\nคุณสามารถกดพิมพ์ข้อความอะไรก็ได้เพื่อเริ่มแจ้งปัญหาร้องเรียนได้ทันทีครับ"
        }
      ]);
    }
  }

  return new Response("ok", { status: 200 });
});
