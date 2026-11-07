"""Study furniture authored from the confirmed reference and metric JSON.

Regular rigid furnishings use the project's native Blender pipeline. Local u is
width, v is front, z is height above the finished floor; no room meshes are reused.
"""
import math, random


def build(api, item):
    handlers = {
        'study_bookcase': bookcase, 'study_display_bookcase': display_bookcase,
        'study_standing_desk': standing_desk,
        'study_task_chair': task_chair, 'study_side_cabinet': side_cabinet,
        'study_desktop_items': desktop_items,
    }
    handlers[item['recipe']](api, item)


def lathe(a, label, center, profile, material, sides=24):
    u,v,z=center; verts=[]
    for h,r in profile:
        verts += [(u+r*math.cos(i*math.tau/sides),v+r*math.sin(i*math.tau/sides),z+h) for i in range(sides)]
    faces=[tuple(range(sides-1,-1,-1))]
    for k in range(len(profile)-1):
        for j in range(sides):
            faces.append((k*sides+j,k*sides+(j+1)%sides,(k+1)*sides+(j+1)%sides,(k+1)*sides+j))
    faces.append(tuple((len(profile)-1)*sides+j for j in range(sides)))
    ob=a.mesh(label,verts,faces,material)
    for p in ob.data.polygons:p.use_smooth=True
    return ob


def books(a, label, u, v, z, count=10, seed=1):
    rng=random.Random(seed); colors=['Study_book_sage','Study_book_rust','Study_book_cream','Study_book_charcoal']
    for i in range(count):
        w=rng.uniform(.026,.044); h=rng.uniform(.19,.27); d=rng.uniform(.155,.20)
        a.box(label+'_cover',(u+w/2,v,z+h/2),(w,d,h),colors[i%4],.0015)
        a.box(label+'_pages',(u+w/2,v+.006,z+h/2),(w-.007,d-.012,h-.012),'Furniture_paper',.001)
        # Visible spine remains wood-facing/front; paper does not replace it.
        a.box(label+'_spine',(u+w/2,v+d/2-.003,z+h/2),(w,.009,h),colors[i%4],.001)
        u+=w+.004


def framed_door(a, label, u, width, v, bottom, top, fill):
    w=width-.008; h=top-bottom-.012; z=(bottom+top)/2; border=.024
    ob=a.box(label+'_infill',(u,v-.009,z),(w-border*2,.012,h-border*2),fill,.002)
    if fill=='Furniture_walnut':vertical_grain(ob)
    for s in [-1,1]:
        vertical_grain(a.box(label+'_stile',(u+s*(w-border)/2,v,z),(border,.034,h),'Furniture_walnut',.003))
        a.box(label+'_rail',(u,v,z+s*(h-border)/2),(w,.034,border),'Furniture_walnut',.003)


def vertical_grain(ob):
    # The retained albedo runs horizontally. Rotate UV axes on vertical boards,
    # leaving horizontal bench/drawer/rail and desk-top grain unchanged.
    for data in ob.data.uv_layers.active.data:
        u,v=data.uv;data.uv=(v,u)


def bookcase(a,c):
    L,D,H=c['dimensions']; U=c['upperDepth']; B=c['baseHeight']
    wood='Furniture_walnut'; back=-D/2; front=D/2; upper_front=back+U
    widths=c['moduleWidths']; edges=[-L/2]
    for w in widths:edges.append(edges[-1]+w)
    # One deep bench and one drawer row, with supporting full-depth divisions.
    a.box('recessed_plinth',(0,0,.032),(L-.07,D-.06,.064),'Furniture_dark_wood',.002)
    a.box('bench_top',(0,0,B-.015),(L,D,.03),wood,.004)
    a.box('base_back',(0,back+.012,.229),(L,.024,.342),wood,.002)
    for u in edges:
        x=max(-L/2+.012,min(L/2-.012,u))
        a.box('base_load_partition',(x,0,.231),(.024,D-.026,.338),wood,.002)
    for i,w in enumerate(widths):
        u=(edges[i]+edges[i+1])/2
        a.box('single_row_drawer_'+str(i),(u,front-.014,.227),(w-.008,.026,.344),wood,.003)
        a.box('drawer_recess_'+str(i),(u,front-.034,.386),(w-.046,.016,.013),'Furniture_dark_wood',.001)
    a.cushion('seat_cushion',(-L/2+c['seatLength']/2,upper_front+c['seatDepth']/2,B+.015),
              (c['seatLength']-.024,c['seatDepth']-.024,.03),'Study_seat_linen',wrinkles=.0004,segments=32,rings=8)
    # Upper 35cm case set back from the deep seat, including lower open niches.
    for u in edges:
        x=max(-L/2+.013,min(L/2-.013,u))
        vertical_grain(a.box('case_partition',(x,back+U/2,(B+H)/2),(.026,U,H-B),wood,.003))
    a.box('case_top',(0,back+U/2,H-.013),(L,U,.026),wood,.003)
    a.box('horizontal_band',(0,upper_front-.018,1.065),(L,.036,.13),wood,.002)
    for i,w in enumerate(widths):
        u=(edges[i]+edges[i+1])/2
        a.box('display_back_'+str(i),(u,back+.012,.725),(w-.026,.018,.55),'Ivory_stone_counter',.001)
        a.box('display_shelf_'+str(i),(u,back+U/2,.438),(w-.026,U-.024,.026),wood,.002)
        vertical_grain(a.box('upper_back_'+str(i),(u,back+.012,1.812),(w-.026,.018,1.35),wood,.001))
        a.box('upper_floor_'+str(i),(u,back+U/2,1.144),(w-.026,U-.024,.028),wood,.002)
        if c.get('details'):
            a.box('niche_light_'+str(i),(u,upper_front-.055,.985),(w-.058,.008,.007),'Study_warm_strip',.001)
    # Frontal order south -> north: double solid, three pale inserts, open, glass.
    left,right=edges[0],edges[1]
    for i in range(2):
        u=left+(i+.5)*widths[0]/2
        framed_door(a,'solid_door',u,widths[0]/2,upper_front+.004,1.13,H,'Furniture_walnut')
    u=(edges[1]+edges[2])/2
    framed_door(a,'pale_insert_door',u,widths[1],upper_front+.004,1.13,H,'Ivory_stone_counter')
    for z in [1.13+(H-1.13)/3,1.13+2*(H-1.13)/3]:
        a.box('insert_crossrail',(u,upper_front+.006,z),(widths[1]-.018,.032,.022),wood,.002)
    for module in [2,3]:
        u=(edges[module]+edges[module+1])/2; w=widths[module]
        for tier in range(1,4):
            z=1.13+(H-1.13)*tier/4
            a.box('shelf_'+str(module)+'_'+str(tier),(u,back+U/2,z),(w-.032,U-.022,.022),wood,.003)
        if c.get('details'):
            for tier in range(4):
                z=1.162+(H-1.13)*tier/4
                if module==2:
                    books(a,'open_tier_'+str(tier),edges[2]+.042,back+U*.54,z,count=12,seed=20+tier)
                elif tier in [0,2]:
                    lathe(a,'glass_vase',(u,back+U*.57,z),[(0,.045),(.015,.065),(.12,.072),(.19,.044),(.21,.047)],'Furniture_ceramic')
                else:
                    for j in range(3):
                        a.box('glass_stack',(u,back+U*.53,z+j*.025+.012),(.22,.15,.023),'Study_book_cream',.002)
                a.box('shelf_light',(u,upper_front-.055,z+.285),(w-.062,.008,.007),'Study_warm_strip',.001)
    for i in range(2):
        u=edges[3]+(i+.5)*widths[3]/2
        framed_door(a,'glass_door',u,widths[3]/2,upper_front+.008,1.13,H,'Study_clear_glass')
        a.tube('glass_pull',[(u+(-1 if i else 1)*.14,upper_front+.037,1.72),
                            (u+(-1 if i else 1)*.14,upper_front+.037,1.82)],.006,'Furniture_brass',8)
    if c.get('details'):
        for i,w in enumerate(widths):
            u=(edges[i]+edges[i+1])/2
            if i in [0,2]:
                lathe(a,'display_vase',(u-.08,back+U*.54,.453),[(0,.042),(.03,.072),(.16,.085),(.25,.04),(.27,.045)],'Furniture_ceramic')
            elif i==1:
                books(a,'display_books',u-.14,back+U*.56,.453,count=5,seed=50)
            else:
                a.box('display_box',(u-.07,back+U*.53,.563),(.27,.21,.22),'Ivory_stone_counter',.009)
                a.box('display_lid',(u-.07,back+U*.53,.679),(.29,.23,.025),wood,.006)


def display_bookcase(a, c):
    length, depth, height = c['dimensions']
    edges = [-length / 2]
    for width in c['moduleWidths']:
        edges.append(edges[-1] + width)
    back, front = -depth / 2, depth / 2
    drawer_bottom, drawer_top = c['drawerBand']
    base, crown = .065, height - .026
    black, wood = 'Study_matte_black', 'Study_honey_wood'
    stone, glass = 'Study_graphite_stone', 'Study_smoked_glass'
    shelf_front = front - .035
    origin = a.world((0, 0, 0))
    width_axis = a.world((1, 0, 0)) - origin
    front_axis = a.world((0, 1, 0)) - origin
    lit_bays = {'narrow': (1, c['narrowShelves'], wood),
                'open': (3, c['openShelves'], stone),
                'glass': (5, c['glassShelves'], stone)}

    def panel(label, left, right, rear, face, bottom, top, material, bevel=.002):
        ob = a.box(label, ((left + right) / 2, (rear + face) / 2, (bottom + top) / 2),
                   (right - left, face - rear, top - bottom), material, bevel)
        if material in (wood, stone):
            mesh = ob.data
            for face in mesh.polygons:
                for loop in face.loop_indices:
                    point = mesh.vertices[mesh.loops[loop].vertex_index].co - origin
                    u, v, z = point.dot(width_axis), point.dot(front_axis), point.z
                    if label == 'floating_drawer':
                        # Match the grain across the six faces with a single cut from the veneer.
                        uv = (.05 + (u - edges[3]) / (drawer_right - drawer_left + .1), .22 + z - drawer_bottom)
                    elif abs(face.normal.z) > .5:
                        uv = (.05 + (u + length / 2) / (length + .16), .08 + (v + depth / 2) / .55)
                    else:
                        uv = (.05 + (u + length / 2) / (length + .16), .04 + z / 2.72)
                    mesh.uv_layers.active.data[loop].uv = uv
        return ob

    def door(label, left, right, bottom, top):
        panel(label, left + .002, right - .002, front - .023, front,
              bottom + .003, top - .003, black)

    panel('shadow_plinth', edges[0], edges[-1], back + .015,
          front - .042, 0, base - .022, black)
    panel('wood_base', edges[0], edges[-1], back, front - .008, base - .022, base, wood)
    panel('case_top', edges[0], edges[-1], back, front, crown, height, black)
    if c.get('details'):
        panel('toe_kick_strip', edges[0] + .024, edges[-1] - .024, front - .041,
              front - .031, base - .027, base - .023, 'Study_warm_strip', .001)
    entry_filler, window_filler = c['sideFillers']
    panel('entry_scribe', edges[0] - entry_filler, edges[0],
          back, front, 0, height, black, .001)
    # Scribe the wall edge around the sill while keeping the door and filler flush.
    sill_bottom, sill_top, sill_trim = c['sillRelief']
    for bottom, top, trim in [(0, sill_bottom, 0), (sill_bottom, sill_top, sill_trim),
                              (sill_top, height, 0)]:
        panel('window_scribe', edges[-1], edges[-1] + window_filler - trim,
              front - .018, front, bottom, top, black, 0)
    for edge in edges:
        left = max(edges[0], min(edge - .009, edges[-1] - .018))
        panel('case_partition', left, left + .018, back, shelf_front, base, crown, black)
    panel('case_back', edges[0], edges[-1], back, back + .012, base, crown, black)

    door('south_solid_door', edges[0], edges[1], base, crown)
    mid = (edges[2] + edges[3]) / 2
    door('solid_pair_door', edges[2], mid, base, crown)
    door('solid_pair_door', mid, edges[3], base, crown)
    door('upper_solid_door', edges[4], edges[5], drawer_top, crown)
    door('lower_solid_door', edges[4], edges[5], base, drawer_bottom)
    door('north_solid_door', edges[6], edges[7], base, crown)

    drawer_left, drawer_right = edges[3], edges[5]
    panel('drawer_case', drawer_left, drawer_right, back + .015, front - .025,
          drawer_bottom, drawer_top, black)
    drawer_width = (drawer_right - drawer_left) / 3
    drawer_height = (drawer_top - drawer_bottom) / 2
    for row in range(2):
        bottom = drawer_bottom + row * drawer_height
        for col in range(3):
            left = drawer_left + col * drawer_width
            panel('floating_drawer', left + .0025, left + drawer_width - .0025,
                  front - .023, front, bottom + .003, bottom + drawer_height - .003, wood)
    panel('lower_stone_recess', edges[3] + .01, edges[4] - .01,
          back + .012, back + .03, base, drawer_bottom, stone)

    for name, (index, shelves, backing) in lit_bays.items():
        left, right = edges[index] + .01, edges[index + 1] - .01
        center = (left + right) / 2
        panel(name + '_back', left, right, back + .012, back + .03,
              shelves[0], crown, backing)
        for tier, z in enumerate(shelves):
            panel(name + '_shelf', left, right, back + .03, shelf_front, z - .023, z, wood)
            if c.get('details'):
                # Recess the diffuser under the next shelf so its light grazes the stone.
                soffit = shelves[tier + 1] - .023 if tier + 1 < len(shelves) else crown
                panel(name + '_strip', left + .02, right - .02,
                      back + .13, back + .14, soffit - .004, soffit, 'Study_warm_strip', .001)
                if name == 'open':
                    if tier % 2 == 0:
                        books(a, 'open_books', left + .055, back + .15, z, count=4, seed=24 + tier)
                    if tier != 2:
                        lathe(a, 'open_vase', (right - .15, back + .165, z),
                              [(0, .039), (.012, .047), (.036, .061), (.075, .065), (.113, .054), (.147, .039), (.172, .034), (.185, .036), (.185, .028), (.173, .027)],
                              'Furniture_ceramic' if tier == 0 else 'Study_book_charcoal')
                elif tier % 2 == 0:
                    books(a, name + '_books', left + .018, back + .15, z,
                          count=3 if name == 'narrow' else 4, seed=30 + tier)
                else:
                    lathe(a, name + '_vase', (center, back + .15, z),
                          [(0, .029), (.012, .042), (.027, .052), (.055, .060), (.077, .060), (.10, .050), (.123, .035), (.14, .034), (.14, .026), (.128, .025)],
                          'Furniture_ceramic' if name == 'glass' else 'Study_book_charcoal')
                    if name == 'glass':
                        books(a, 'glass_books', center + .055, back + .15, z, count=4, seed=43 + tier)

    for offset in c['openDividers']:
        u = edges[3] + offset
        panel('open_vertical_mullion', u - .007, u + .007, shelf_front - .026,
              shelf_front, drawer_top, crown, black, .001)

    glass_mid = (edges[5] + edges[6]) / 2
    for left, right in ((edges[5] + .003, glass_mid - .002), (glass_mid + .002, edges[6] - .003)):
        stile = .015
        bottom, top = base + .003, crown - .003
        panel('glass_leaf', left + stile, right - stile, front - .021, front - .015,
              bottom + stile, top - stile, glass, 0)
        for edge in (left, right - stile):
            panel('glass_stile', edge, edge + stile, front - .029, front, bottom, top, black, .001)
        for z in (bottom, top - stile):
            panel('glass_rail', left + stile, right - stile, front - .029, front, z, z + stile, black, .001)
        pull = right - stile / 2 if right < glass_mid else left + stile / 2
        panel('glass_pull', pull - .004, pull + .004, front - .014, front,
              1.02, 1.23, 'Furniture_brass', .002)


def standing_desk(a,c):
    L,D,H=c['dimensions']; top=c['topThickness']; black='Furniture_charcoal'
    a.box('desk_top',(0,0,H-top/2),(L,D,top),'Furniture_table_wood',.004)
    a.box('under_top_beam',(0,-.01,H-.074),(L-.18,.09,.068),black,.006)
    for s in [-1,1]:
        u=s*(L/2-.16)
        a.box('top_crossrail',(u,0,H-.044),(.075,D-.12,.027),black,.004)
        a.box('telescoping_lower',(u,0,.239),(.074,.074,.388),black,.006)
        a.box('telescoping_upper',(u,0,.528),(.063,.063,.376),black,.004)
        a.box('T_foot',(u,0,.038),(.086,D-.085,.038),black,.008)
        for end in [-1,1]:
            lathe(a,'leveling_pad',(u,end*(D/2-.082),.006),[(0,.027),(.013,.027)],'Furniture_dark_wood',16)
    a.box('desk_controller',(-L/2+.14,D/2-.038,H-.048),(.115,.066,.034),black,.004)
    a.box('controller_display',(-L/2+.14,D/2-.003,H-.048),(.058,.004,.012),'Study_controller',.001)


def curved_panel(a,label,width,height,v,z,details=False):
    # A shallow concave back with rounded outline, split into lumbar/upper/head.
    n=48; outline=[]
    for j in range(n+1):
        theta=j*math.tau/n
        u=width/2*a.signed(math.cos(theta),.35)
        h=height/2*a.signed(math.sin(theta),.35)
        vv=v+.055*(u/(width/2))**2-.025*h/height
        outline.append((u,vv,z+h))
    a.tube(label+'_rim',outline,.012,'Furniture_charcoal',10)
    # Concave filled membrane is transparent/dark, with physical weave in detail pass.
    # Quad grid follows the same smooth curve as the rim. A triangle fan would
    # crease the non-planar membrane into a star around its center.
    rows=19;columns=21;verts=[]
    for k in range(rows):
        s=-.97+1.94*k/(rows-1);h=height*s/2
        limit=width/2*(1-abs(s)**5.7)**(1/5.7)
        for j in range(columns):
            u=limit*(-1+2*j/(columns-1))
            verts.append((u,v+.055*(u/(width/2))**2-.025*h/height,z+h))
    faces=[(k*columns+j,k*columns+j+1,(k+1)*columns+j+1,(k+1)*columns+j)
           for k in range(rows-1) for j in range(columns-1)]
    ob=a.mesh(label+'_membrane',verts,faces,'Study_chair_mesh')
    for p in ob.data.polygons:p.use_smooth=True
    if details:
        for i in range(-11,12):
            u=i*width/25
            limit=height/2*(1-abs(u/(width/2))**5.7)**(1/5.7)*.94
            a.tube(label+'_vertical_weave',[(u,v+.055*(u/(width/2))**2-.025*h/height,z+h)
                   for h in [-limit,0,limit]],.0012,'Study_mesh_thread',5)
        for i in range(-8,9):
            h=i*height/19
            limit=width/2*(1-abs(h/(height/2))**5.7)**(1/5.7)*.94
            a.tube(label+'_horizontal_weave',[(u,v+.055*(u/(width/2))**2-.025*h/height-.001,z+h)
                   for u in [-limit,-limit/2,0,limit/2,limit]],.0012,'Study_mesh_thread',5)


def task_chair(a,c):
    metal='Study_chrome'; black='Furniture_charcoal'; R=c['baseDiameter']/2-.037
    lathe(a,'gas_lift',(0,0,.10),[(0,.038),(.24,.027),(.33,.021)],metal,20)
    a.box('seat_mechanism',(0,-.03,.391),(.18,.20,.065),black,.015)
    for j in range(5):
        theta=j*math.tau/5+.3;u=R*math.cos(theta);v=R*math.sin(theta)
        a.tube('five_spoke_base',[(0,0,.18),(u*.52,v*.52,.125),(u,v,.081)],.024,metal,10)
        a.tube('caster_swivel',[(u,v,.085),(u,v,.045)],.013,black,10)
        # Twin rounded caster wheels; the outer radius defines the 73.5cm base.
        for s in [-1,1]:
            off=.017*s; dx=-math.sin(theta)*off;dy=math.cos(theta)*off
            p=(u+dx,v+dy,.038)
            a.tube('caster_wheel',[(p[0]-math.sin(theta)*.009,p[1]+math.cos(theta)*.009,p[2]),
                                 (p[0]+math.sin(theta)*.009,p[1]-math.cos(theta)*.009,p[2])],.035,black,16)
    a.cushion('mesh_seat',(0,.015,.454),(.515,.51,.072),'Study_seat_dark',wrinkles=.0012,segments=40,rings=10)
    for s in [-1,1]:
        a.tube('arm_support',[(s*.245,-.08,.423),(s*.275,-.08,.59),(s*.28,.05,.665)],.015,metal,10)
        a.cushion('arm_pad',(s*.285,.035,.69),(.085,.26,.041),black,wrinkles=.0002,segments=24,rings=6)
    a.tube('rear_spine',[(0,-.17,.37),(0,-.305,.50),(0,-.345,.77),(0,-.36,1.10),(0,-.365,1.18)],.020,metal,12)
    for s in [-1,1]:
        a.tube('back_support',[(s*.20,-.195,.45),(s*.225,-.31,.63),(s*.195,-.34,.96)],.016,metal,10)
    curved_panel(a,'lumbar_mesh',.43,.19,-.294,.61,c.get('details'))
    curved_panel(a,'upper_mesh',.45,.38,-.337,.935,c.get('details'))
    curved_panel(a,'headrest_mesh',.255,.13,-.367,1.205,c.get('details'))
    a.tube('headrest_bracket',[(0,-.36,1.07),(0,-.38,1.19)],.012,metal,10)
    a.tube('adjustment_lever',[(.10,-.02,.38),(.25,.02,.39)],.008,black,8)


def side_cabinet(a,c):
    L,D,H=c['dimensions'];wood='Furniture_walnut'
    a.box('plinth',(0,0,.040),(L-.065,D-.045,.080),'Furniture_dark_wood',.003)
    a.box('cabinet_top',(0,0,H-.014),(L,D,.028),wood,.004)
    a.box('cabinet_back',(0,-D/2+.01,H/2),(L,.02,H-.055),wood,.002)
    for s in [-1,1]:
        a.box('side',(s*(L/2-.012),0,H/2),(.024,D,H-.032),wood,.003)
        u=s*L/4
        vertical_grain(a.box('tall_door',(u,D/2-.012,.427),(L/2-.020,.024,.690),wood,.003))
        a.box('drawer',(u,D/2-.012,.932),(L/2-.020,.024,.268),wood,.003)
        a.box('recess_pull',(u,D/2-.035,.788),(L/2-.06,.025,.017),'Furniture_dark_wood',.001)
    a.box('middle_partition',(0,0,H/2),(.022,D-.025,H-.05),wood,.002)
    a.box('internal_shelf',(0,0,.50),(L-.034,D-.03,.022),wood,.002)


def desktop_items(a,c):
    h=c['baseHeight']; black='Furniture_charcoal'
    # Laptop and task lamp are separate selectable accessories, not desk dimensions.
    a.box('laptop_base',(0,.02,h+.009),(.30,.20,.016),'Study_chrome',.003)
    verts=[]
    for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(-1,1,-1),(1,1,-1),(-1,-1,1),(1,-1,1),(-1,1,1),(1,1,1)]:
        verts.append((sx*.15,-.075+sy*.006-sz*.029,h+.115+sz*.11))
    a.mesh('laptop_screen',verts,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(1,3,7,5),(3,2,6,7),(2,0,4,6)],black)
    lathe(a,'task_lamp_base',(.46,-.16,h),[(0,.067),(.012,.067)],black,24)
    a.tube('task_lamp_stem',[(.46,-.16,h+.012),(.46,-.16,h+.39)],.009,black,12)
    a.box('task_lamp_head',(.41,-.16,h+.398),(.19,.029,.018),black,.003)
    a.box('task_lamp_diffuser',(.41,-.16,h+.387),(.15,.023,.006),'Study_warm_strip',.001)
