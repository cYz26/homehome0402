"""Static joinery for the approved northwest children's room."""

import math
import bpy

PINK = 'Childroom_blush'
ROSE = 'Childroom_rose'
IVORY = 'Childroom_ivory'
OAK = 'Oak_plank_05'
BRASS = 'Furniture_brass'


def build(api, item):
    globals()[item['recipe'].removeprefix('childroom_')](api, item)


def arch(center, width, bottom, top):
    radius = width / 2
    return [(center - radius, bottom), (center + radius, bottom)] + [
        (center + radius * math.cos(angle), top - radius + radius * math.sin(angle))
        for angle in (math.pi * i / 20 for i in range(21))
    ]


def profile(api, name, outline, face, thickness, material):
    size = len(outline)
    vertices = [(u, face + offset, z) for offset in (-thickness / 2, thickness / 2)
                for u, z in outline]
    ends = [tuple(reversed(range(size))), tuple(range(size, 2 * size))]
    sides = [(i, (i + 1) % size, (i + 1) % size + size, i + size) for i in range(size)]
    return api.mesh(name, vertices, ends + sides, material)


def scallop(api, u, v, width, bottom, top):
    panel = profile(api, 'scallop', arch(u, width, bottom, top), v, .027, PINK)
    radius = .022
    slot = [
        (u + radius * math.cos(angle), center + radius * math.sin(angle))
        for center, start in ((top - .118, 0), (bottom + .061, math.pi))
        for angle in (start + math.pi * i / 12 for i in range(13))
    ]
    cutter = profile(api, 'slot_tool', slot, v, .12, PINK)
    api.PARTS.remove(cutter)
    opening = panel.modifiers.new('Rounded slot', 'BOOLEAN')
    opening.operation = 'DIFFERENCE'
    opening.object = cutter
    bpy.context.view_layer.objects.active = panel
    bpy.ops.object.modifier_apply(modifier=opening.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    bevel = panel.modifiers.new('Soft edge', 'BEVEL')
    bevel.width = .0035
    bevel.segments = 3


def bed(api, item):
    length, depth, high = item['dimensions']
    deck = item['deckHeight']
    mattress = item['mattressHeight']
    post = .064
    u_end = (length - post) / 2
    v_end = (depth - post) / 2
    for u in (-u_end, u_end):
        for v in (-v_end, v_end):
            api.box('post', (u, v, (high - .028) / 2),
                    (post, post, high - .028), PINK, .009)
            api.cushion('post_cap', (u, v, high - .027), (.073, .073, .050),
                        PINK, wrinkles=0, segments=16, rings=8)
    for v in (-v_end, v_end):
        api.box('deck_rail', (0, v, deck - .047), (length - .045, .045, .094), PINK)
    api.box('deck', (0, 0, deck - .025), (length, depth - .060, .050), PINK)
    api.box('mattress', (0, 0, deck + mattress / 2),
            (length - .082, depth - .116, mattress), IVORY, .032)
    api.cushion('folded_cover', (.36, -.05, deck + mattress + .012),
                (1.06, depth - .125, .066), 'Childroom_quilt', wrinkles=.0025)
    api.cushion('rose_pillow', (-.70, -.06, deck + mattress + .048),
                (.31, .54, .095), ROSE, tilt=.11)

    # End slats stop at the north boarding opening beside the wardrobe.
    for u, left, right in ((-u_end, -v_end, v_end),
                           (u_end, -v_end, item['entryStart'])):
        api.box('end_top_rail', (u, (left + right) / 2, high - .055),
                (.032, right - left, .045), PINK)
        count = round((right - left) / .104)
        for index in range(1, count):
            v = left + (right - left) * index / count
            api.box('end_slat', (u, v, (deck + high - .056) / 2),
                    (.025, .026, high - .056 - deck), PINK, .004)
    api.box('wall_side_rail', (0, -v_end, high - .073),
            (length - .075, .028, .080), PINK)
    start, end = item['caddyEnd'], u_end - post / 2
    width = (end - start) / item['scallops']
    for index in range(item['scallops']):
        scallop(api, start + width * (index + .5), v_end, width - .004, deck, high - .027)
    api.box('caddy_mount_rail', ((-u_end + start) / 2, v_end, high - .112),
            (start + u_end, .036, .038), PINK)


def stairs(api, item):
    width, depth, height = item['dimensions']
    rise = item['rise']
    lower = item['lowerTreadDepth']
    thickness = item['treadThickness']
    assert math.isclose(height, 2 * rise)
    # Both drawers are accessible from the east. The stepped sides end flush
    # under their treads and the high tread meets the bed's north-end opening.
    for index, (back, front) in enumerate(((-depth / 2, depth / 2 - lower),
                                          (depth / 2 - lower, depth / 2))):
        low = rise if index == 0 else 0
        high = low + rise
        api.box(f'riser_{2 - index}', (0, (back + front) / 2, (low + high - thickness) / 2),
                (width, front - back, rise - thickness), IVORY, .004)
        api.box(f'tread_{2 - index}', (0, (back + front) / 2, high - thickness / 2),
                (width, front - back, thickness), OAK, .004)
        api.box(f'drawer_{2 - index}', (0, front + .001, (low + high - thickness) / 2),
                (width - .012, .005, rise - thickness - .012), IVORY, .002)
        api.box('finger_pull', (0, front + .004, high - thickness - .022),
                (.087, .005, .026), 'Childroom_recess', .007)
        if index == 0:
            api.box('base_at_wardrobe', (0, (back + front) / 2, low / 2),
                    (width, front - back, low), IVORY, .003)


def wardrobe(api, item):
    width, depth, height = item['dimensions']
    lower = item['upperDoorsBottom']
    api.box('carcass', (0, -.009, height / 2), (width, depth - .018, height), IVORY, .006)
    for index in range(3):
        z = lower * (index + .5) / 3
        api.box('base_drawer', (0, depth / 2, z),
                (width - .016, .018, lower / 3 - .009), IVORY)
    for side in (-1, 1):
        u = side * width / 4
        api.box('tall_door', (u, depth / 2, (lower + height) / 2),
                (width / 2 - .008, .021, height - lower - .009), IVORY)
        border = arch(u, width / 2 - .054, lower + .035, height - .037)
        inset = arch(u, width / 2 - .078, lower + .047, height - .051)
        profile(api, 'arch_trim', border, depth / 2 + .013, .007, 'Childroom_quilt')
        profile(api, 'arch_inset', inset, depth / 2 + .017, .007, PINK)
        x, y, z = side * .039, depth / 2 + .022, lower + .31
        api.tube('paired_pull', [(x, y, z), (x, y + .020, z + .015),
                                 (x, y + .020, z + .112), (x, y, z + .127)], .006, BRASS)


def curtains(api, item):
    length, depth, height = item['dimensions']
    for side in (-1, 1):
        width = (length - item['centerOpening']) / 2
        center = side * (item['centerOpening'] + width) / 2
        columns, rows = 97, 12
        vertices = []
        for row in range(rows):
            h = row / (rows - 1)
            for col in range(columns):
                s = col / (columns - 1)
                wave = math.cos(s * 24 * math.tau + h * .32 * math.sin(s * 26))
                u = center + width * (s - .5) * (1 - .018 * h)
                v = depth * .38 * wave * (1 - .31 * h)
                z = item['hem'] + height * h + .004 * (1 - h) * wave
                vertices.append((u, v, z))
        faces = [(i, i + 1, i + 1 + columns, i + columns)
                 for row in range(rows - 1) for i in range(row * columns, (row + 1) * columns - 1)]
        panel = api.mesh('pleated_panel', vertices, faces, ROSE)
        for face in panel.data.polygons:
            face.use_smooth = True
        solid = panel.modifiers.new('Linen thickness', 'SOLIDIFY')
        solid.thickness = .0015


def display_book(api, u, v, z, width, height, color):
    api.box('pages', (u, v - .004, z + height / 2), (width - .006, .016, height - .006), IVORY, .001)
    api.box('picture_book_cover', (u, v + .006, z + height / 2), (width, .006, height), color, .002)
    api.cushion('cover_motif', (u, v + .010, z + height * .56),
                (width * .42, .004, height * .29), 'Childroom_quilt', wrinkles=0,
                segments=12, rings=6)


def caddy(api, item):
    width, depth, height = item['dimensions']
    z = item['bottom']
    api.box('back_closes_rail_gap', (0, -.039, z + height / 2),
            (width, .018, height), PINK, .009)
    api.box('pocket_bottom', (0, .008, z + .011), (width, depth, .022), PINK, .006)
    api.box('pocket_front', (0, depth / 2, z + .060), (width, .018, .120), PINK, .009)
    for side in (-1, 1):
        api.box('pocket_end', (side * (width / 2 - .008), .008, z + .058),
                (.016, depth - .012, .116), PINK, .004)
        u = side * (width / 2 - .046)
        api.tube('removable_hook', [(u, -.013, z + height - .072),
                                    (u, -.018, z + height - .015),
                                    (u, -.050, z + height + .006),
                                    (u, -.090, z + height),
                                    (u, -.098, z + height - .040)], .009, PINK)
        display_book(api, side * .060, .013, z + .023, .100, .151,
                     'Childroom_sage' if side > 0 else 'Childroom_quilt')


def bookshelves(api, item):
    length, depth, height = item['dimensions']
    base = item['bottom']
    api.box('backboard', (0, -depth / 2 + .008, base + height / 2),
            (length, .016, height), PINK)
    for side in (-1, 1):
        api.box('rounded_end', (side * (length / 2 - .012), 0, base + height / 2),
                (.025, depth, height), PINK, .012)
    for index in range(2):
        z = base + index * height / 2
        api.box('shelf', (0, 0, z + .013), (length, depth, .026), PINK)
        api.box('retaining_lip', (0, depth / 2 - .009, z + .060),
                (length - .035, .018, .034), PINK)
        for n in range(5):
            display_book(api, (n - 2) * length / 5 + (.033 if index else 0),
                         -.005, z + .028, .108 + .022 * (n % 3), .15 + .018 * (n % 2),
                         ('Childroom_sage', 'Childroom_quilt', 'Childroom_rose')[(n + index) % 3])


def nook(api, item):
    length, depth, _ = item['dimensions']
    api.box('woven_mat', (0, 0, .014), (length, depth, .028), 'Childroom_quilt', .012)
    for u in (-.52, -.18, .16, .50):
        api.box('woven_stripe', (u, 0, .029), (.048, depth - .08, .0025), PINK, .001)
    api.cushion('floor_pillow', (.42, -.22, .110), (.38, .31, .16),
                ROSE, tilt=.20, segments=24, rings=9)
    api.cushion('floor_pillow_small', (.13, -.21, .085), (.27, .26, .12),
                IVORY, tilt=-.15, segments=24, rings=9)


def desk(api, item):
    width, depth, top = item['dimensions']
    api.box('oak_top', (0, 0, top - .017), (width, depth, .034), OAK, .011)
    for side in (-1, 1):
        u = side * (width / 2 - .11)
        api.box('T_foot', (u, 0, .026), (.076, depth - .018, .052), IVORY, .014)
        api.box('adjustable_column', (u, -.04, .24), (.065, .067, .43), IVORY, .010)
        api.box('inner_column', (u, -.04, .539), (.049, .052, .304), IVORY, .006)
        api.box('riser_support', (side * (width / 2 - .041), -depth / 2 + .061, top + .101),
                (.028, .026, .206), IVORY, .006)
    api.box('crossbrace', (0, -.12, .34), (width - .20, .032, .084), IVORY)
    api.box('book_riser', (0, -depth / 2 + .101, top + .207), (width - .055, .18, .025), OAK)
    api.box('riser_back', (0, -depth / 2 + .028, top + .249),
            (width - .059, .018, .065), IVORY)
    api.tube('book_retain_bar', [(-width / 2 + .059, -depth / 2 + .16, top + .262),
                                (width / 2 - .059, -depth / 2 + .16, top + .262)], .009, IVORY)
    for n in range(3):
        display_book(api, .15 + n * .072, -depth / 2 + .087, top + .221,
                     .064, .086 + n * .017, ('Childroom_sage', 'Childroom_quilt', ROSE)[n])


def chair(api, item):
    width, depth, high = item['dimensions']
    seat = item['seatHeight']
    for index in range(5):
        angle = math.tau * index / 5
        u, v = width * .42 * math.cos(angle), depth * .42 * math.sin(angle)
        api.tube('five_star_base', [(0, 0, .101), (u * .72, v * .72, .066), (u, v, .048)],
                 .017, IVORY)
        api.tube('caster', [(u - .015, v, .027), (u + .015, v, .027)], .025,
                 'Childroom_recess', 12)
    api.tube('seat_column', [(0, 0, .08), (0, 0, seat - .031)], .028, IVORY, 16)
    api.tube('back_support', [(0, -.11, seat - .038), (0, -.19, seat + .023),
                              (0, -.20, high - .11)], .022, IVORY, 12)
    api.cushion('padded_seat', (0, .006, seat), (width - .035, depth - .083, .069),
                ROSE, segments=32, rings=10)
    api.cushion('padded_back', (0, -.175, (seat + high) / 2 + .028),
                (width - .067, .067, high - seat - .056), ROSE, tilt=.083,
                segments=32, rings=10)
    for side in (-1, 1):
        u = side * (width / 2 - .024)
        api.tube('chair_arm', [(u, -.102, seat), (u, -.101, seat + .142),
                               (u, .098, seat + .142)], .013, IVORY)
        api.box('arm_pad', (u, .006, seat + .148), (.038, .201, .023), PINK, .009)


def wall_finish(api, item):
    length, depth, height = item['dimensions']
    api.box('paint_surface', (0, 0, item['bottom'] + height / 2),
            (length, depth, height), 'Childroom_wall', 0)
